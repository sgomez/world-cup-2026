import { describe, expect, it } from "vitest";
import worldcupData from "@/../data/worldcup.json";
import { getAllMatches, getMatchByNum } from "./matches";

describe("Match numbering in worldcup.json", () => {
  const matches = worldcupData.matches as Array<{ num?: number }>;

  it("assigns a num to every match", () => {
    for (const match of matches) {
      expect(typeof match.num).toBe("number");
    }
  });

  it("covers the full 1–104 range with no gaps and no duplicates", () => {
    const nums = matches.map((m) => m.num).sort((a, b) => (a ?? 0) - (b ?? 0));
    const expected = Array.from({ length: 104 }, (_, i) => i + 1);
    expect(nums).toEqual(expected);
  });

  it("numbers exactly 104 matches", () => {
    expect(matches).toHaveLength(104);
  });

  it("numbers match 1 as the opener (Mexico vs South Africa)", () => {
    const opener = getMatchByNum(1);
    expect(opener?.team1).toBe("Mexico");
    expect(opener?.team2).toBe("South Africa");
  });

  it("numbers the third-place match 103 and the Final 104", () => {
    expect(getMatchByNum(103)?.round).toBe("Match for third place");
    expect(getMatchByNum(104)?.round).toBe("Final");
  });

  it("keeps the pre-existing knockout numbering 73–102", () => {
    expect(getMatchByNum(73)?.round).toBe("Round of 32");
    expect(getMatchByNum(102)?.round).toBe("Semi-final");
  });
});

describe("getMatchByNum", () => {
  it("returns the match addressed by its Match Number", () => {
    const match = getMatchByNum(2);
    expect(match?.team1).toBe("South Korea");
    expect(match?.team2).toBe("Czech Republic");
  });

  it("returns undefined for a num outside 1–104", () => {
    expect(getMatchByNum(0)).toBeUndefined();
    expect(getMatchByNum(105)).toBeUndefined();
  });
});

describe("getAllMatches", () => {
  it("returns all 104 matches", () => {
    expect(getAllMatches()).toHaveLength(104);
  });
});
