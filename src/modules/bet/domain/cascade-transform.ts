import { err, ok, type Result } from "neverthrow";
import { getGroups } from "@/lib/teams";
import type { ScoreableContentArrays } from "@/modules/score";
import type { ParsedRow } from "./sheet-parser";

export type SkipReason = {
  rowNumber: number;
  reason: string;
};

export const COLUMN_TO_FIFA_CODE: Record<number, string> = {
  2: "MEX",
  3: "RSA",
  4: "KOR",
  5: "CZE", // Group A
  6: "CAN",
  7: "BIH",
  8: "QAT",
  9: "SUI", // Group B
  10: "BRA",
  11: "MAR",
  12: "HAI",
  13: "SCO", // Group C
  14: "USA",
  15: "PAR",
  16: "AUS",
  17: "TUR", // Group D
  18: "GER",
  19: "CUW",
  20: "CIV",
  21: "ECU", // Group E
  22: "NED",
  23: "JPN",
  24: "SWE",
  25: "TUN", // Group F
  26: "BEL",
  27: "EGY",
  28: "IRN",
  29: "NZL", // Group G
  30: "ESP",
  31: "CPV",
  32: "KSA",
  33: "URU", // Group H
  34: "FRA",
  35: "SEN",
  36: "IRQ",
  37: "NOR", // Group I
  38: "ARG",
  39: "ALG",
  40: "AUT",
  41: "JOR", // Group J
  42: "POR",
  43: "COD",
  44: "UZB",
  45: "COL", // Group K
  46: "ENG",
  47: "CRO",
  48: "GHA",
  49: "PAN", // Group L
};

const KNOWN_TEAM_IDS = new Set(
  getGroups("en").flatMap((g) => g.teams.map((t) => t.id)),
);

const VALID_LETTERS = new Set(["D", "O", "C", "S", "B", "F", "G", ""]);

export function transformParsedRow(
  row: ParsedRow,
): Result<ScoreableContentArrays, SkipReason> {
  const rowNumber = row.rowNumber;

  if (!row.col0 || !/^\d+[TPX]$/.test(row.col0)) {
    return err({
      rowNumber,
      reason: `Malformed row identifier: ${row.col0 || "empty"}`,
    });
  }

  if (!row.col1 || row.col1.trim() === "") {
    return err({
      rowNumber,
      reason: "Malformed row: participant name is empty",
    });
  }

  const R32: string[] = [];
  const R16: string[] = [];
  const QF: string[] = [];
  const SF: string[] = [];
  const F: string[] = [];
  const champions: string[] = [];
  const thirdPlaces: string[] = [];

  for (let colIndex = 2; colIndex <= 49; colIndex++) {
    const value = row.predictions[colIndex];
    const letter =
      value !== undefined && value !== null
        ? String(value).trim().toUpperCase()
        : "";

    if (!VALID_LETTERS.has(letter)) {
      return err({
        rowNumber,
        reason: `Unknown prediction letter: ${letter}`,
      });
    }

    if (letter === "") {
      continue;
    }

    const fifaCode = COLUMN_TO_FIFA_CODE[colIndex];
    if (!fifaCode) {
      return err({
        rowNumber,
        reason: `Unknown column index: ${colIndex}`,
      });
    }

    const teamId = fifaCode.toLowerCase();
    if (!KNOWN_TEAM_IDS.has(teamId)) {
      return err({
        rowNumber,
        reason: `Unknown team: ${fifaCode}`,
      });
    }

    if (["D", "O", "C", "S", "F", "B", "G"].includes(letter)) {
      R32.push(teamId);
    }
    if (["O", "C", "S", "F", "B", "G"].includes(letter)) {
      R16.push(teamId);
    }
    if (["C", "S", "F", "B", "G"].includes(letter)) {
      QF.push(teamId);
    }
    if (["S", "F", "B", "G"].includes(letter)) {
      SF.push(teamId);
    }
    if (["F", "G"].includes(letter)) {
      F.push(teamId);
    }
    if (letter === "G") {
      champions.push(teamId);
    }
    if (letter === "B") {
      thirdPlaces.push(teamId);
    }
  }

  const uniqueR32 = Array.from(new Set(R32));
  const uniqueR16 = Array.from(new Set(R16));
  const uniqueQF = Array.from(new Set(QF));
  const uniqueSF = Array.from(new Set(SF));
  const uniqueF = Array.from(new Set(F));

  if (uniqueR32.length > 32) {
    return err({
      rowNumber,
      reason: `R32 round exceeds cap of 32 (got ${uniqueR32.length})`,
    });
  }
  if (uniqueR16.length > 16) {
    return err({
      rowNumber,
      reason: `R16 round exceeds cap of 16 (got ${uniqueR16.length})`,
    });
  }
  if (uniqueQF.length > 8) {
    return err({
      rowNumber,
      reason: `QF round exceeds cap of 8 (got ${uniqueQF.length})`,
    });
  }
  if (uniqueSF.length > 4) {
    return err({
      rowNumber,
      reason: `SF round exceeds cap of 4 (got ${uniqueSF.length})`,
    });
  }
  if (uniqueF.length > 2) {
    return err({
      rowNumber,
      reason: `Final round exceeds cap of 2 (got ${uniqueF.length})`,
    });
  }

  if (champions.length > 1) {
    return err({
      rowNumber,
      reason: `Multiple champion predictions: ${champions.join(", ")}`,
    });
  }
  if (thirdPlaces.length > 1) {
    return err({
      rowNumber,
      reason: `Multiple third-place predictions: ${thirdPlaces.join(", ")}`,
    });
  }

  return ok({
    R32: uniqueR32,
    R16: uniqueR16,
    QF: uniqueQF,
    SF: uniqueSF,
    F: uniqueF,
    champion: champions[0] ?? null,
    thirdPlace: thirdPlaces[0] ?? null,
  });
}
