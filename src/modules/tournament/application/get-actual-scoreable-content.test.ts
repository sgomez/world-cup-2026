import { describe, expect, it } from "vitest";
import { Tournament } from "../domain/tournament";
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

  describe("getActualScoreableContent — provisional divergence", () => {
    it("uses provisional results for scoring but keeps display bracketView settled", () => {
      // If group A has 1 live match and 0 finished matches
      const liveResults = [
        { num: 1, status: "live", goals1: 2, goals2: 0 }, // mex (team1) vs rsa (team2)
      ];

      // 1. Scoring answer key uses getActualScoreableContent which uses provisional mode
      const scoringResult = getActualScoreableContent(null, liveResults as any);
      // Since group A has started, 1A (mex) and 2A (rsa) should be projected and thus scoreable
      expect(scoringResult.R32).toContain("MEX");
      expect(scoringResult.R32).toContain("KOR");

      // 2. Display path uses finishedOnly (default) and should NOT project mex or rsa yet (shows TBD)

      const activeTournament = Tournament.createDefault();
      const bracketView = activeTournament.bracketView(liveResults as any);
      // R32-73 is 2A vs 2B. Since 2A is not settled, team1Id should be null (TBD)
      expect(bracketView["R32-73"].team1Id).toBeNull();
    });
  });
});
