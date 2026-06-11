import { describe, expect, it } from "vitest";
import { getActualScoreableContent } from "./get-actual-scoreable-content";

describe("getActualScoreableContent", () => {
  it("returns an empty key when tournament is null and no LiveResults exist", () => {
    const result = getActualScoreableContent(null, []);

    expect(result.R32).toEqual([]);
    expect(result.R16).toEqual([]);
    expect(result.QF).toEqual([]);
    expect(result.SF).toEqual([]);
    expect(result.F).toEqual([]);
    expect(result.champion).toBeNull();
    expect(result.thirdPlace).toBeNull();
  });
});
