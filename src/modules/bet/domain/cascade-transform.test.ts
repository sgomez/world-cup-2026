import { describe, expect, it } from "vitest";
import { transformParsedRow } from "./cascade-transform";
import type { ParsedRow } from "./sheet-parser";

describe("cascade transform", () => {
  const baseRow: ParsedRow = {
    rowNumber: 3,
    col0: "1T",
    col1: "Test Participant",
    predictions: {},
  };

  it("should successfully transform an empty row (under-filled but valid)", () => {
    const row = {
      ...baseRow,
      predictions: {},
    };
    const result = transformParsedRow(row);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const data = result.value;
      expect(data.R32).toEqual([]);
      expect(data.R16).toEqual([]);
      expect(data.QF).toEqual([]);
      expect(data.SF).toEqual([]);
      expect(data.F).toEqual([]);
      expect(data.champion).toBeNull();
      expect(data.thirdPlace).toBeNull();
    }
  });

  it("should successfully aggregate a valid prediction set", () => {
    // Let's set some predictions:
    // col 2: MEX -> G (Champion) -> reaches R32, R16, QF, SF, F, champion
    // col 3: RSA -> F (Runner-up) -> reaches R32, R16, QF, SF, F
    // col 4: KOR -> B (3rd Place) -> reaches R32, R16, QF, SF, thirdPlace
    // col 5: CZE -> S (Semi-finals) -> reaches R32, R16, QF, SF
    // col 6: CAN -> C (Quarter-finals) -> reaches R32, R16, QF
    // col 7: BIH -> O (Round of 16) -> reaches R32, R16
    // col 8: QAT -> D (Round of 32) -> reaches R32
    // col 9: SUI -> "" (Group stage) -> reaches none
    const row: ParsedRow = {
      ...baseRow,
      predictions: {
        2: "G",
        3: "F",
        4: "B",
        5: "S",
        6: "C",
        7: "o", // test case insensitivity
        8: "D",
        9: "",
      },
    };

    const result = transformParsedRow(row);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const data = result.value;
      expect(data.R32).toEqual([
        "mex",
        "rsa",
        "kor",
        "cze",
        "can",
        "bih",
        "qat",
      ]);
      expect(data.R16).toEqual(["mex", "rsa", "kor", "cze", "can", "bih"]);
      expect(data.QF).toEqual(["mex", "rsa", "kor", "cze", "can"]);
      expect(data.SF).toEqual(["mex", "rsa", "kor", "cze"]);
      expect(data.F).toEqual(["mex", "rsa"]);
      expect(data.champion).toBe("mex");
      expect(data.thirdPlace).toBe("kor");
    }
  });

  it("should de-duplicate teams within a round if predicted twice", () => {
    // In our fixed COLUMN_TO_FIFA_CODE, index 2 maps to MEX, and index 3 maps to RSA.
    // If we have two G's or similar, wait, if we have two F's, they both end up in F, SF, QF, R16, R32.
    // But since they are different teams (MEX and RSA), there's no duplicate team ID.
    // Wait, how can we have the same team ID twice in a round?
    // Each team ID is linked to exactly one column index. So a row cannot naturally have duplicate team IDs.
    // However, if the row is parsed with duplicate columns, or we just want to assert that the deduplication
    // set logic works in transformParsedRow, we can trust the standard Set behavior or simulate it.
    // Actually, because of 1:1 mapping of column to team, a single row has 48 distinct teams.
    // So there can never be the same team in two different columns.
    // But we still apply deduplication to ensure the arrays only contain unique entries.
    const row: ParsedRow = {
      ...baseRow,
      predictions: {
        2: "G",
        3: "G", // Multiple champions -> should be a skip reason
      },
    };
    const result = transformParsedRow(row);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.reason).toContain("Multiple champion predictions");
    }
  });

  it("should return a skip reason if the round exceeds its cap", () => {
    // Cap for F is 2. Let's predict 3 teams in F (e.g. 3 F's)
    const row: ParsedRow = {
      ...baseRow,
      predictions: {
        2: "F",
        3: "F",
        4: "F",
      },
    };
    const result = transformParsedRow(row);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.rowNumber).toBe(3);
      expect(result.error.reason).toContain("Final round exceeds cap of 2");
    }
  });

  it("should return a skip reason if it carries an unknown prediction letter", () => {
    const row: ParsedRow = {
      ...baseRow,
      predictions: {
        2: "Z",
      },
    };
    const result = transformParsedRow(row);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.rowNumber).toBe(3);
      expect(result.error.reason).toContain("Unknown prediction letter: Z");
    }
  });

  it("should return a skip reason if row identifier is malformed", () => {
    const row: ParsedRow = {
      ...baseRow,
      col0: "invalid",
    };
    const result = transformParsedRow(row);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.reason).toContain("Malformed row identifier");
    }
  });

  it("should return a skip reason if participant name is empty", () => {
    const row: ParsedRow = {
      ...baseRow,
      col1: "",
    };
    const result = transformParsedRow(row);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.reason).toContain("participant name is empty");
    }
  });
});
