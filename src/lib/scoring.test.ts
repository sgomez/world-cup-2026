import { describe, expect, it } from "vitest";
import { createInitialState, type KnockoutMatch } from "./prediction-state";
import { extractScoreableContent } from "./scoring";

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
