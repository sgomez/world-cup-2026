import { describe, expect, it } from "vitest";
import { createInitialState, type KnockoutMatch } from "@/modules/bracket";
import {
  CHAMPION_POINTS,
  extractScoreableContent,
  ROUND_POINTS,
  type ScoreableContent,
  score,
  scoreBreakdown,
  THIRD_PLACE_POINTS,
} from "./index";

describe("points policy", () => {
  it("ROUND_POINTS defines the per-team points for each round", () => {
    expect(ROUND_POINTS.R32).toBe(3);
    expect(ROUND_POINTS.R16).toBe(4);
    expect(ROUND_POINTS.QF).toBe(5);
    expect(ROUND_POINTS.SF).toBe(6);
    expect(ROUND_POINTS.F).toBe(8);
  });

  it("CHAMPION_POINTS is 10", () => {
    expect(CHAMPION_POINTS).toBe(10);
  });

  it("THIRD_PLACE_POINTS is 5", () => {
    expect(THIRD_PLACE_POINTS).toBe(5);
  });
});

describe("extractScoreableContent", () => {
  it("returns empty sets and null winners for empty knockout matches", () => {
    const emptyMatches: Record<string, KnockoutMatch> = {};
    const content = extractScoreableContent(emptyMatches);

    expect(content.R32.size).toBe(0);
    expect(content.R16.size).toBe(0);
    expect(content.QF.size).toBe(0);
    expect(content.SF.size).toBe(0);
    expect(content.F.size).toBe(0);
    expect(content.champion).toBeNull();
    expect(content.thirdPlace).toBeNull();
  });

  it("extracts teams and winners correctly", () => {
    const knockoutMatches: Record<string, KnockoutMatch> = {
      "R32-73": {
        id: "R32-73",
        round: "R32",
        team1Id: "usa",
        team2Id: "mex",
        winnerId: "usa",
        loserId: "mex",
      },
      "R16-89": {
        id: "R16-89",
        round: "R16",
        team1Id: "usa",
        team2Id: "can",
        winnerId: "can",
        loserId: "usa",
      },
      F: {
        id: "F",
        round: "F",
        team1Id: "can",
        team2Id: "bra",
        winnerId: "bra",
        loserId: "can",
      },
      "3RD": {
        id: "3RD",
        round: "3RD",
        team1Id: "usa",
        team2Id: "arg",
        winnerId: "arg",
        loserId: "usa",
      },
    };

    const content = extractScoreableContent(knockoutMatches);

    // Should uppercase the team IDs
    expect(content.R32).toContain("USA");
    expect(content.R32).toContain("MEX");
    expect(content.R32.size).toBe(2);

    expect(content.R16).toContain("USA");
    expect(content.R16).toContain("CAN");
    expect(content.R16.size).toBe(2);

    expect(content.F).toContain("CAN");
    expect(content.F).toContain("BRA");
    expect(content.F.size).toBe(2);

    expect(content.champion).toBe("BRA");
    expect(content.thirdPlace).toBe("ARG");

    // Other sets should be empty
    expect(content.QF.size).toBe(0);
    expect(content.SF.size).toBe(0);
  });

  it("works with real tournament initial state", () => {
    const state = createInitialState(null);
    const content = extractScoreableContent(state.knockoutMatches);

    // Initial state should have all R32 teams populated, but rounds beyond R32 are empty
    expect(content.R32.size).toBe(32);
    expect(content.R16.size).toBe(0);
    expect(content.QF.size).toBe(0);
    expect(content.SF.size).toBe(0);
    expect(content.F.size).toBe(0);
    expect(content.champion).toBeNull();
    expect(content.thirdPlace).toBeNull();
  });
});

describe("score", () => {
  const emptyKey = (): ScoreableContent => ({
    R32: new Set<string>(),
    R16: new Set<string>(),
    QF: new Set<string>(),
    SF: new Set<string>(),
    F: new Set<string>(),
    champion: null,
    thirdPlace: null,
  });

  it("returns 0 points when there are no matches", () => {
    const bet = emptyKey();
    bet.R32.add("USA");
    const key = emptyKey();

    expect(score(bet, key)).toBe(0);
  });

  it("awards round of 32 points for matching teams (phase-membership / right-team wrong-opponent)", () => {
    const bet = emptyKey();
    bet.R32.add("USA");
    bet.R32.add("MEX");

    const key = emptyKey();
    key.R32.add("USA"); // Right team, matches
    key.R32.add("CAN"); // Wrong team

    // R32 is 3 points per team
    expect(score(bet, key)).toBe(3);
  });

  it("awards champion and third-place winner points by identity", () => {
    const bet = emptyKey();
    bet.champion = "BRA";
    bet.thirdPlace = "ARG";

    const key = emptyKey();
    key.champion = "BRA"; // Matches, 10 points
    key.thirdPlace = "ARG"; // Matches, 5 points

    expect(score(bet, key)).toBe(15);
  });

  it("does not award champion or third-place points for wrong predictions", () => {
    const bet = emptyKey();
    bet.champion = "BRA";
    bet.thirdPlace = "ARG";

    const key = emptyKey();
    key.champion = "FRA";
    key.thirdPlace = "GER";

    expect(score(bet, key)).toBe(0);
  });

  it("correctly aggregates score across all rounds", () => {
    const bet = emptyKey();
    bet.R32.add("USA"); // 3 pts
    bet.R16.add("FRA"); // 4 pts
    bet.QF.add("ARG"); // 5 pts
    bet.SF.add("BRA"); // 6 pts
    bet.F.add("GER"); // 8 pts
    bet.champion = "GER"; // 10 pts
    bet.thirdPlace = "BRA"; // 5 pts

    const key = emptyKey();
    key.R32.add("USA");
    key.R16.add("FRA");
    key.QF.add("ARG");
    key.SF.add("BRA");
    key.F.add("GER");
    key.champion = "GER";
    key.thirdPlace = "BRA";

    expect(score(bet, key)).toBe(3 + 4 + 5 + 6 + 8 + 10 + 5);
  });
});

describe("scoreBreakdown", () => {
  const emptyKey = (): ScoreableContent => ({
    R32: new Set<string>(),
    R16: new Set<string>(),
    QF: new Set<string>(),
    SF: new Set<string>(),
    F: new Set<string>(),
    champion: null,
    thirdPlace: null,
  });

  it("handles empty keys and empty predictions correctly", () => {
    const bet = emptyKey();
    const key = emptyKey();
    const res = scoreBreakdown(bet, key);

    expect(res.R32).toEqual({ matched: 0, points: 0 });
    expect(res.R16).toEqual({ matched: 0, points: 0 });
    expect(res.QF).toEqual({ matched: 0, points: 0 });
    expect(res.SF).toEqual({ matched: 0, points: 0 });
    expect(res.F).toEqual({ matched: 0, points: 0 });
    expect(res.champion).toEqual({ matched: false, points: 0 });
    expect(res.thirdPlace).toEqual({ matched: false, points: 0 });
    expect(res.total).toBe(0);
  });

  it("computes per-round matched and points correctly including phase-membership rule", () => {
    const bet = emptyKey();
    bet.R32.add("USA");
    bet.R32.add("MEX");
    bet.R16.add("FRA");
    bet.R16.add("GER");

    const key = emptyKey();
    key.R32.add("USA"); // Right team, wrong opponent, scores!
    key.R32.add("CAN"); // Wrong team
    key.R16.add("FRA");
    key.R16.add("GER");

    const res = scoreBreakdown(bet, key);
    expect(res.R32).toEqual({ matched: 1, points: 3 });
    expect(res.R16).toEqual({ matched: 2, points: 8 });
    expect(res.total).toBe(11);
  });

  it("computes champion and third place points correctly", () => {
    const bet = emptyKey();
    bet.champion = "BRA";
    bet.thirdPlace = "ARG";

    const key = emptyKey();
    key.champion = "BRA";
    key.thirdPlace = "ARG";

    const res = scoreBreakdown(bet, key);
    expect(res.champion).toEqual({ matched: true, points: 10 });
    expect(res.thirdPlace).toEqual({ matched: true, points: 5 });
    expect(res.total).toBe(15);
  });

  it("computes partial keys correctly where some matches are not completed", () => {
    const bet = emptyKey();
    bet.R32.add("USA");
    bet.R32.add("MEX");
    bet.champion = "BRA";

    const key = emptyKey();
    key.R32.add("USA");
    // rest is empty / not yet set

    const res = scoreBreakdown(bet, key);
    expect(res.R32).toEqual({ matched: 1, points: 3 });
    expect(res.champion).toEqual({ matched: false, points: 0 });
    expect(res.total).toBe(3);
  });

  it("total always equals the sum of breakdown points", () => {
    const bet = emptyKey();
    bet.R32.add("USA");
    bet.R16.add("FRA");
    bet.QF.add("ARG");
    bet.SF.add("BRA");
    bet.F.add("GER");
    bet.champion = "GER";
    bet.thirdPlace = "BRA";

    const key = emptyKey();
    key.R32.add("USA");
    key.R16.add("FRA");
    key.QF.add("ARG");
    key.SF.add("BRA");
    key.F.add("GER");
    key.champion = "GER";
    key.thirdPlace = "BRA";

    const res = scoreBreakdown(bet, key);
    const sum =
      res.R32.points +
      res.R16.points +
      res.QF.points +
      res.SF.points +
      res.F.points +
      res.champion.points +
      res.thirdPlace.points;
    expect(res.total).toBe(sum);
  });

  it("full breakdown shape includes all rounds and winner fields", () => {
    const bet = emptyKey();
    bet.R32.add("USA");
    bet.R16.add("FRA");
    bet.QF.add("ARG");
    bet.SF.add("BRA");
    bet.F.add("GER");
    bet.champion = "GER";
    bet.thirdPlace = "BRA";

    const key = emptyKey();
    key.R32.add("USA");
    key.R16.add("FRA");
    key.QF.add("ARG");
    key.SF.add("BRA");
    key.F.add("GER");
    key.champion = "GER";
    key.thirdPlace = "BRA";

    const res = scoreBreakdown(bet, key);

    // Verify the exact shape and per-round point values
    expect(res.R32).toEqual({ matched: 1, points: ROUND_POINTS.R32 });
    expect(res.R16).toEqual({ matched: 1, points: ROUND_POINTS.R16 });
    expect(res.QF).toEqual({ matched: 1, points: ROUND_POINTS.QF });
    expect(res.SF).toEqual({ matched: 1, points: ROUND_POINTS.SF });
    expect(res.F).toEqual({ matched: 1, points: ROUND_POINTS.F });
    expect(res.champion).toEqual({ matched: true, points: CHAMPION_POINTS });
    expect(res.thirdPlace).toEqual({
      matched: true,
      points: THIRD_PLACE_POINTS,
    });
    expect(res.total).toBe(3 + 4 + 5 + 6 + 8 + 10 + 5);
  });
});

describe("client-bundle guard", () => {
  it("score module imports no server-only or Prisma symbols", async () => {
    // If this import throws (e.g. due to 'server-only'), the test fails.
    // This guard ensures the module remains isomorphic and safe for client bundles
    // (e.g. bet-prediction.tsx and score-tab.tsx import it in the browser bundle).
    const mod = await import("./index");
    expect(typeof mod.score).toBe("function");
    expect(typeof mod.scoreBreakdown).toBe("function");
  });
});
