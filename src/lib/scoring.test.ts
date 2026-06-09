import { describe, expect, it } from "vitest";
import { createInitialState, type KnockoutMatch } from "./prediction-state";
import {
  extractScoreableContent,
  type ScoreableContent,
  scoreBet,
} from "./scoring";

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

describe("scoreBet", () => {
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

    expect(scoreBet(bet, key)).toBe(0);
  });

  it("awards round of 32 points for matching teams (phase-membership / right-team wrong-opponent)", () => {
    const bet = emptyKey();
    bet.R32.add("USA");
    bet.R32.add("MEX");

    const key = emptyKey();
    key.R32.add("USA"); // Right team, matches
    key.R32.add("CAN"); // Wrong team

    // R32 is 3 points per team
    expect(scoreBet(bet, key)).toBe(3);
  });

  it("awards champion and third-place winner points by identity", () => {
    const bet = emptyKey();
    bet.champion = "BRA";
    bet.thirdPlace = "ARG";

    const key = emptyKey();
    key.champion = "BRA"; // Matches, 10 points
    key.thirdPlace = "ARG"; // Matches, 5 points

    expect(scoreBet(bet, key)).toBe(15);
  });

  it("does not award champion or third-place points for wrong predictions", () => {
    const bet = emptyKey();
    bet.champion = "BRA";
    bet.thirdPlace = "ARG";

    const key = emptyKey();
    key.champion = "FRA";
    key.thirdPlace = "GER";

    expect(scoreBet(bet, key)).toBe(0);
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

    expect(scoreBet(bet, key)).toBe(3 + 4 + 5 + 6 + 8 + 10 + 5);
  });
});
