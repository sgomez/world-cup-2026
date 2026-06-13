import { err, ok, type Result } from "neverthrow";
import worldcupData from "@/../data/worldcup.json";

/**
 * A single match from the tournament schedule (`data/worldcup.json`).
 *
 * Every match carries a stable, unique `num` — its **Match Number** (see
 * CONTEXT.md): 1–72 for the group stage in official FIFA chronological order,
 * 73–102 for the existing knockout numbering, 103 for the third-place match and
 * 104 for the Final. It is the identifier a LiveResult is keyed by and the value
 * the live-update API addresses.
 */
export type Match = {
  round: string;
  num: number;
  date: string;
  time: string;
  team1: string;
  team2: string;
  group?: string;
  ground: string;
};

const allMatches = worldcupData.matches as Match[];

const matchesByNum = new Map<number, Match>(
  allMatches.map((match) => [match.num, match]),
);

/** Returns every match in the tournament. */
export function getAllMatches(): Match[] {
  return allMatches;
}

/** Looks a match up by its Match Number, or `undefined` if none exists. */
export function getMatchByNum(num: number): Match | undefined {
  return matchesByNum.get(num);
}

/**
 * Resolves a match's date plus its timezone-bearing time (e.g. 13:00 UTC-6)
 * into an absolute UTC instant, returning a neverthrow Result.
 * Defaults to Z when no offset is present.
 */
export function getKickoffInstant(match: {
  date: string;
  time: string;
}): Result<Date, Error> {
  if (!match.date || !match.time) {
    return err(new Error("Missing date or time"));
  }

  // Validate date format (YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(match.date)) {
    return err(new Error("Invalid date format, expected YYYY-MM-DD"));
  }

  // Validate time format (starts with HH:MM)
  if (!/^\d{2}:\d{2}/.test(match.time)) {
    return err(new Error("Invalid time format, expected HH:MM"));
  }

  const timePortionMatch = match.time.match(/^(\d{2}:\d{2})/);
  const timePortion = timePortionMatch ? timePortionMatch[1] : "00:00";

  // Parse time offset. Example "13:00 UTC-6" or "13:00 UTC+2"
  const offsetMatch = match.time.match(/UTC([-+]\d+)/);
  let parsedOffset = "";
  if (offsetMatch) {
    const val = parseInt(offsetMatch[1], 10);
    const sign = val >= 0 ? "+" : "-";
    const absVal = Math.abs(val);
    const padded = String(absVal).padStart(2, "0");
    parsedOffset = `${sign}${padded}:00`;
  } else {
    parsedOffset = "Z";
  }

  const isoStr = `${match.date}T${timePortion}${parsedOffset}`;
  const dateObj = new Date(isoStr);

  if (Number.isNaN(dateObj.getTime())) {
    return err(new Error("Invalid resulting date"));
  }

  return ok(dateObj);
}

const numToSlotMap: Record<number, string> = {
  ...Object.fromEntries(
    [73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88].map(
      (n) => [n, `R32-${n}`],
    ),
  ),
  ...Object.fromEntries(
    [89, 90, 91, 92, 93, 94, 95, 96].map((n) => [n, `R16-${n}`]),
  ),
  ...Object.fromEntries([97, 98, 99, 100].map((n) => [n, `QF-${n}`])),
  101: "SF-101",
  102: "SF-102",
  103: "3RD",
  104: "F",
};

const slotToNumMap = new Map<string, number>(
  Object.entries(numToSlotMap).map(([numStr, slot]) => [slot, Number(numStr)]),
);

/**
 * Returns the bracket slot ID for a given Match Number.
 * Group-stage numbers (1-72) or invalid numbers return undefined.
 */
export function slotForNum(num: number): string | undefined {
  return numToSlotMap[num];
}

/**
 * Returns the Match Number for a given bracket slot ID.
 * Returns undefined if the slot is not found.
 */
export function numForSlot(slot: string): number | undefined {
  return slotToNumMap.get(slot);
}

export type LiveMatchResult = {
  num: number;
  status: string;
  goals1: number;
  goals2: number;
  penalties1?: number;
  penalties2?: number;
};

/**
 * Derives the match status ("upcoming" | "live" | "finished") from the live result list.
 * An absent or "upcoming" result resolves to "upcoming".
 */
export function matchStatus(
  num: number,
  liveResults: LiveMatchResult[],
): "upcoming" | "live" | "finished" {
  const result = liveResults.find((r) => r.num === num);
  if (!result || result.status === "upcoming") {
    return "upcoming";
  }
  if (result.status === "live" || result.status === "finished") {
    return result.status as "live" | "finished";
  }
  return "upcoming";
}

/**
 * Derives the score for a given Match Number from the live result list.
 * Returns undefined if the match has not started (i.e. status is "upcoming" or absent).
 */
export function matchScore(
  num: number,
  liveResults: LiveMatchResult[],
):
  | {
      goals1: number;
      goals2: number;
      penalties1?: number;
      penalties2?: number;
    }
  | undefined {
  const result = liveResults.find((r) => r.num === num);
  if (!result || result.status === "upcoming") {
    return undefined;
  }
  return {
    goals1: result.goals1,
    goals2: result.goals2,
    penalties1: result.penalties1,
    penalties2: result.penalties2,
  };
}
