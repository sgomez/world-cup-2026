import { describe, expect, it } from "vitest";
import combinationsData from "../../data/worldcup.combinations.json";
import {
  computeR32Matches,
  createInitialState,
  getAllTeamsLookup,
  getOrderedThirdPlaceTeams,
  predictionReducer,
} from "./prediction-state";

describe("createInitialState", () => {
  it("builds groupOrders from saved predictions when present", () => {
    const saved = {
      groupOrders: { A: ["mex", "rsa", "kor", "cze"] },
      thirdPlaceOrder: ["3rd-a"],
    };
    const state = createInitialState(saved);
    expect(state.groupOrders.A).toEqual(["mex", "rsa", "kor", "cze"]);
  });

  it("falls back to original group order when no saved predictions", () => {
    const state = createInitialState(null);
    expect(state.groupOrders.A).toBeDefined();
    expect(state.groupOrders.A).toHaveLength(4);
    expect(state.thirdPlaceOrder).toHaveLength(12);
  });

  it("thirdPlaceOrder uses lowercase group letters (3rd-a format)", () => {
    const state = createInitialState(null);
    expect(state.thirdPlaceOrder[0]).toBe("3rd-a");
    expect(state.thirdPlaceOrder[11]).toBe("3rd-l");
  });

  it("restores valid stored knockout winners and propagates to next match", () => {
    const state = createInitialState(null);
    const winner = state.groupOrders.A[1]; // 2A runner-up
    // R32-73: 2A vs 2B
    const restored = createInitialState(
      {
        groupOrders: state.groupOrders,
        thirdPlaceOrder: state.thirdPlaceOrder,
      },
      { "R32-73": winner },
    );
    expect(restored.knockoutMatches["R32-73"].winnerId).toBe(winner);
    // R32-73 → R16-90 slot 1
    expect(restored.knockoutMatches["R16-90"].team1Id).toBe(winner);
  });

  it("discards stale knockout winners when team is not in match", () => {
    const state = createInitialState(null);
    const restored = createInitialState(
      {
        groupOrders: state.groupOrders,
        thirdPlaceOrder: state.thirdPlaceOrder,
      },
      { "R32-73": "nonexistent-team-xyz" },
    );
    expect(restored.knockoutMatches["R32-73"].winnerId).toBeNull();
    expect(restored.knockoutMatches["R16-90"].team1Id).toBeNull();
  });

  it("applies stored winners in round order so propagation is consistent", () => {
    const state = createInitialState(null);
    const r32Winner = state.groupOrders.A[1]; // 2A
    const r75Winner = state.groupOrders.F[0]; // 1F (R32-75 is 1F vs 2C)
    // R32-73 winner goes to R16-90 slot 1; R32-75 winner goes to R16-90 slot 2
    const restored = createInitialState(
      {
        groupOrders: state.groupOrders,
        thirdPlaceOrder: state.thirdPlaceOrder,
      },
      { "R32-73": r32Winner, "R32-75": r75Winner },
    );
    expect(restored.knockoutMatches["R16-90"].team1Id).toBe(r32Winner);
    expect(restored.knockoutMatches["R16-90"].team2Id).toBe(r75Winner);
  });
});

describe("computeR32Matches", () => {
  it("R32-73 has 2A vs 2B (runner-ups of groups A and B)", () => {
    const state = createInitialState(null);
    const { groupOrders, thirdPlaceOrder } = state;
    const matches = computeR32Matches(
      groupOrders,
      thirdPlaceOrder,
      combinationsData,
    );
    expect(matches["R32-73"].team1Id).toBe(groupOrders.A[1]); // 2A
    expect(matches["R32-73"].team2Id).toBe(groupOrders.B[1]); // 2B
  });

  it("R32-79 (1A vs 3rd) resolves third-place team via combinations", () => {
    const state = createInitialState(null);
    const { groupOrders, thirdPlaceOrder } = state;
    // Default top 8 = 3rd-a..3rd-h → key "abcdefgh"
    // combinations["abcdefgh"]["1a"] = "3h" → group H's third
    const matches = computeR32Matches(
      groupOrders,
      thirdPlaceOrder,
      combinationsData,
    );
    expect(matches["R32-79"].team1Id).toBe(groupOrders.A[0]); // 1A
    expect(matches["R32-79"].team2Id).toBe(groupOrders.H[2]); // 3H
  });

  it("R32-82 (1G vs 3rd) resolves third-place team via combinations", () => {
    const state = createInitialState(null);
    const { groupOrders, thirdPlaceOrder } = state;
    // combinations["abcdefgh"]["1g"] = "3a" → group A's third
    const matches = computeR32Matches(
      groupOrders,
      thirdPlaceOrder,
      combinationsData,
    );
    expect(matches["R32-82"].team2Id).toBe(groupOrders.A[2]); // 3A
  });

  it("changing top-8 third-place order changes combination key and third-place assignments", () => {
    const state = createInitialState(null);
    const { groupOrders } = state;
    // Top 8 = l,k,j,i,h,g,f,e → sorted → "efghijkl"
    const newOrder = [
      "3rd-l",
      "3rd-k",
      "3rd-j",
      "3rd-i",
      "3rd-h",
      "3rd-g",
      "3rd-f",
      "3rd-e",
      "3rd-d",
      "3rd-c",
      "3rd-b",
      "3rd-a",
    ];
    const matches = computeR32Matches(groupOrders, newOrder, combinationsData);
    // combinations["efghijkl"]["1a"] = "3e" → group E's third
    expect(matches["R32-79"].team2Id).toBe(groupOrders.E[2]); // 3E
  });

  it("produces 16 matches with IDs R32-73 through R32-88", () => {
    const state = createInitialState(null);
    const matches = computeR32Matches(
      state.groupOrders,
      state.thirdPlaceOrder,
      combinationsData,
    );
    expect(Object.keys(matches)).toHaveLength(16);
    for (let n = 73; n <= 88; n++) {
      expect(matches[`R32-${n}`]).toBeDefined();
    }
  });
});

describe("predictionReducer", () => {
  it("SET_GROUP_ORDER updates the specified group", () => {
    const state = createInitialState(null);
    const next = predictionReducer(state, {
      type: "SET_GROUP_ORDER",
      groupName: "A",
      orderedIds: ["cze", "kor", "rsa", "mex"],
    });
    expect(next.groupOrders.A).toEqual(["cze", "kor", "rsa", "mex"]);
    expect(next.groupOrders.B).toEqual(state.groupOrders.B);
  });

  it("SET_THIRD_PLACE_ORDER updates thirdPlaceOrder", () => {
    const state = createInitialState(null);
    const newOrder = [
      "3rd-l",
      "3rd-k",
      "3rd-j",
      "3rd-i",
      "3rd-h",
      "3rd-g",
      "3rd-f",
      "3rd-e",
      "3rd-d",
      "3rd-c",
      "3rd-b",
      "3rd-a",
    ];
    const next = predictionReducer(state, {
      type: "SET_THIRD_PLACE_ORDER",
      orderedIds: newOrder,
    });
    expect(next.thirdPlaceOrder).toEqual(newOrder);
  });

  it("SET_GROUP_ORDER updates R32 team slots for that group", () => {
    const state = createInitialState(null);
    const [a0, a1, a2, a3] = state.groupOrders.A;
    const next = predictionReducer(state, {
      type: "SET_GROUP_ORDER",
      groupName: "A",
      orderedIds: [a1, a0, a2, a3], // swap 1A and 2A
    });
    // R32-73: 2A vs 2B — new 2A = a0
    expect(next.knockoutMatches["R32-73"].team1Id).toBe(a0);
    // R32-79: 1A vs 3rd — new 1A = a1
    expect(next.knockoutMatches["R32-79"].team1Id).toBe(a1);
  });

  it("SET_GROUP_ORDER cascade-clears R32 winner when team leaves match", () => {
    const state = createInitialState(null);
    const [a0, a1, a2, a3] = state.groupOrders.A;
    // Set R32-73 winner to 2A (a1)
    const withWinner = predictionReducer(state, {
      type: "SET_KNOCKOUT_WINNER",
      matchId: "R32-73",
      winnerId: a1,
    });
    expect(withWinner.knockoutMatches["R32-73"].winnerId).toBe(a1);
    expect(withWinner.knockoutMatches["R16-90"].team1Id).toBe(a1);

    // Now swap 1A and 2A — a1 becomes 1A, not 2A, so it leaves R32-73
    const next = predictionReducer(withWinner, {
      type: "SET_GROUP_ORDER",
      groupName: "A",
      orderedIds: [a1, a0, a2, a3],
    });
    // R32-73 winner cleared (a1 no longer in match)
    expect(next.knockoutMatches["R32-73"].winnerId).toBeNull();
    // R16-90 team1Id cleared
    expect(next.knockoutMatches["R16-90"].team1Id).toBeNull();
  });

  it("SET_GROUP_ORDER cascade-clears downstream R16 winner when R32 winner changes", () => {
    let state = createInitialState(null);
    const [a0, a1, a2, a3] = state.groupOrders.A;
    const [_b0, _b1] = state.groupOrders.B;
    // Set R32-73 winner (a1 = 2A)
    state = predictionReducer(state, {
      type: "SET_KNOCKOUT_WINNER",
      matchId: "R32-73",
      winnerId: a1,
    });
    // Set R32-75 winner (b0 = 1F... actually R32-75 is 1F vs 2C, not group B)
    // Let me just set R16-90 winner manually... but we can't do that directly
    // Instead: need both teams in R16-90 to set a winner
    // R16-90: W73 vs W75. R32-75 = 1F vs 2C
    // Let me use the F group (group F)
    const [f0] = state.groupOrders.F;
    state = predictionReducer(state, {
      type: "SET_KNOCKOUT_WINNER",
      matchId: "R32-75",
      winnerId: f0,
    });
    // Now R16-90 has team1=a1, team2=f0 — set winner to a1
    state = predictionReducer(state, {
      type: "SET_KNOCKOUT_WINNER",
      matchId: "R16-90",
      winnerId: a1,
    });
    expect(state.knockoutMatches["R16-90"].winnerId).toBe(a1);
    expect(state.knockoutMatches["QF-97"].team2Id).toBe(a1);

    // Now change group A so a1 leaves R32-73
    state = predictionReducer(state, {
      type: "SET_GROUP_ORDER",
      groupName: "A",
      orderedIds: [a1, a0, a2, a3],
    });
    // R32-73 winner cleared, R16-90 team1 cleared, R16-90 winner cleared
    expect(state.knockoutMatches["R32-73"].winnerId).toBeNull();
    expect(state.knockoutMatches["R16-90"].team1Id).toBeNull();
    expect(state.knockoutMatches["R16-90"].winnerId).toBeNull();
    // QF-97 team2 was a1 from R16-90 win — cleared
    expect(state.knockoutMatches["QF-97"].team2Id).toBeNull();
  });

  it("SET_THIRD_PLACE_ORDER cascade-clears when third-place team in a match changes", () => {
    const state = createInitialState(null);
    // Default: R32-82 has 1G vs combinations["abcdefgh"]["1g"] = "3a" = groupA[2]
    const thirdA = state.groupOrders.A[2];
    expect(state.knockoutMatches["R32-82"].team2Id).toBe(thirdA);

    // Set winner of R32-82 to thirdA
    const withWinner = predictionReducer(state, {
      type: "SET_KNOCKOUT_WINNER",
      matchId: "R32-82",
      winnerId: thirdA,
    });
    expect(withWinner.knockoutMatches["R32-82"].winnerId).toBe(thirdA);

    // Change top-8 order so group A's 3rd is no longer in top 8
    const newOrder = [
      "3rd-l",
      "3rd-k",
      "3rd-j",
      "3rd-i",
      "3rd-h",
      "3rd-g",
      "3rd-f",
      "3rd-e",
      "3rd-d",
      "3rd-c",
      "3rd-b",
      "3rd-a",
    ];
    const next = predictionReducer(withWinner, {
      type: "SET_THIRD_PLACE_ORDER",
      orderedIds: newOrder,
    });
    // R32-82 team2 changed (no longer thirdA), so winner cleared
    expect(next.knockoutMatches["R32-82"].winnerId).toBeNull();
  });

  it("SET_KNOCKOUT_WINNER propagates winner to next match slot", () => {
    const state = createInitialState(null);
    const winner = state.groupOrders.A[1]; // 2A
    const next = predictionReducer(state, {
      type: "SET_KNOCKOUT_WINNER",
      matchId: "R32-73",
      winnerId: winner,
    });
    // R32-73 → R16-90 slot 1
    expect(next.knockoutMatches["R32-73"].winnerId).toBe(winner);
    expect(next.knockoutMatches["R32-73"].loserId).toBe(state.groupOrders.B[1]);
    expect(next.knockoutMatches["R16-90"].team1Id).toBe(winner);
  });

  it("SET_KNOCKOUT_WINNER clears downstream winners in cascade when winner changes", () => {
    let state = createInitialState(null);
    const [_a0, a1, a2] = state.groupOrders.A;
    const [f0] = state.groupOrders.F;

    // Set R32-73 winner to a1 (2A)
    state = predictionReducer(state, {
      type: "SET_KNOCKOUT_WINNER",
      matchId: "R32-73",
      winnerId: a1,
    });
    // Set R32-75 winner to f0
    state = predictionReducer(state, {
      type: "SET_KNOCKOUT_WINNER",
      matchId: "R32-75",
      winnerId: f0,
    });
    // Set R16-90 winner to a1
    state = predictionReducer(state, {
      type: "SET_KNOCKOUT_WINNER",
      matchId: "R16-90",
      winnerId: a1,
    });
    expect(state.knockoutMatches["QF-97"].team2Id).toBe(a1);

    // Now, change the winner of R32-73 to a2
    state = predictionReducer(state, {
      type: "SET_KNOCKOUT_WINNER",
      matchId: "R32-73",
      winnerId: a2,
    });

    // R32-73 winner should be a2
    expect(state.knockoutMatches["R32-73"].winnerId).toBe(a2);
    // R16-90 team1Id should be a2
    expect(state.knockoutMatches["R16-90"].team1Id).toBe(a2);
    // R16-90 winnerId should be cleared (null) since a1 is no longer in R16-90!
    expect(state.knockoutMatches["R16-90"].winnerId).toBeNull();
    // QF-97 team2Id should be cleared (null)
    expect(state.knockoutMatches["QF-97"].team2Id).toBeNull();
  });

  it("SET_KNOCKOUT_WINNER for SF-101 sets loser in 3RD match slot 1", () => {
    // Build up state with teams in SF-101
    // SF-101: W97 vs W98 — need to trace back from R32
    // This is complex to build. Let's directly craft a state with SF-101 having teams.
    const state = createInitialState(null);
    // Manually pick teams by setting SF-101 via progression
    // Easiest path: QF-97 winner → SF-101 slot1, QF-98 winner → SF-101 slot2
    // We need QF-97 to have teams: R16-89 winner + R16-90 winner → QF-97
    // This chain is long; let's just check that when we set SF-101 winner, loser goes to 3RD
    const stateWithSF = {
      ...state,
      knockoutMatches: {
        ...state.knockoutMatches,
        "SF-101": {
          id: "SF-101",
          round: "SF" as const,
          team1Id: "team-x",
          team2Id: "team-y",
          winnerId: null,
          loserId: null,
        },
        "3RD": {
          id: "3RD",
          round: "3RD" as const,
          team1Id: null,
          team2Id: null,
          winnerId: null,
          loserId: null,
        },
        F: {
          id: "F",
          round: "F" as const,
          team1Id: null,
          team2Id: null,
          winnerId: null,
          loserId: null,
        },
      },
    };
    const next = predictionReducer(stateWithSF, {
      type: "SET_KNOCKOUT_WINNER",
      matchId: "SF-101",
      winnerId: "team-x",
    });
    expect(next.knockoutMatches["SF-101"].winnerId).toBe("team-x");
    expect(next.knockoutMatches["SF-101"].loserId).toBe("team-y");
    expect(next.knockoutMatches["3RD"].team1Id).toBe("team-y"); // loser goes to 3RD slot 1
    expect(next.knockoutMatches.F.team1Id).toBe("team-x"); // winner goes to Final slot 1
  });

  it("SET_KNOCKOUT_WINNER for SF-102 sets loser in 3RD match slot 2 and winner in Final slot 2", () => {
    const state = createInitialState(null);
    const stateWithSF = {
      ...state,
      knockoutMatches: {
        ...state.knockoutMatches,
        "SF-102": {
          id: "SF-102",
          round: "SF" as const,
          team1Id: "team-a",
          team2Id: "team-b",
          winnerId: null,
          loserId: null,
        },
        "3RD": {
          id: "3RD",
          round: "3RD" as const,
          team1Id: null,
          team2Id: null,
          winnerId: null,
          loserId: null,
        },
        F: {
          id: "F",
          round: "F" as const,
          team1Id: null,
          team2Id: null,
          winnerId: null,
          loserId: null,
        },
      },
    };
    const next = predictionReducer(stateWithSF, {
      type: "SET_KNOCKOUT_WINNER",
      matchId: "SF-102",
      winnerId: "team-b",
    });
    expect(next.knockoutMatches["3RD"].team2Id).toBe("team-a"); // loser → 3RD slot 2
    expect(next.knockoutMatches.F.team2Id).toBe("team-b"); // winner → Final slot 2
  });

  it("CLEAR_KNOCKOUT_WINNER clears winner and removes team from downstream slot", () => {
    const state = createInitialState(null);
    const winner = state.groupOrders.A[1]; // 2A
    const withWinner = predictionReducer(state, {
      type: "SET_KNOCKOUT_WINNER",
      matchId: "R32-73",
      winnerId: winner,
    });
    expect(withWinner.knockoutMatches["R16-90"].team1Id).toBe(winner);

    const cleared = predictionReducer(withWinner, {
      type: "CLEAR_KNOCKOUT_WINNER",
      matchId: "R32-73",
    });
    expect(cleared.knockoutMatches["R32-73"].winnerId).toBeNull();
    expect(cleared.knockoutMatches["R16-90"].team1Id).toBeNull();
  });

  it("CLEAR_KNOCKOUT_WINNER cascades forward to remove team from QF when R16 winner depended on it", () => {
    let state = createInitialState(null);
    const [_a0, a1] = state.groupOrders.A;
    const [f0] = state.groupOrders.F;
    // Set chain: R32-73 winner → R16-90, then R16-90 winner → QF-97
    state = predictionReducer(state, {
      type: "SET_KNOCKOUT_WINNER",
      matchId: "R32-73",
      winnerId: a1,
    });
    state = predictionReducer(state, {
      type: "SET_KNOCKOUT_WINNER",
      matchId: "R32-75",
      winnerId: f0,
    });
    state = predictionReducer(state, {
      type: "SET_KNOCKOUT_WINNER",
      matchId: "R16-90",
      winnerId: a1,
    });
    expect(state.knockoutMatches["QF-97"].team2Id).toBe(a1);

    // Clear R32-73 winner — cascades to clear R16-90 team1 and R16-90 winner, then QF-97 team2
    state = predictionReducer(state, {
      type: "CLEAR_KNOCKOUT_WINNER",
      matchId: "R32-73",
    });
    expect(state.knockoutMatches["R32-73"].winnerId).toBeNull();
    expect(state.knockoutMatches["R16-90"].team1Id).toBeNull();
    expect(state.knockoutMatches["R16-90"].winnerId).toBeNull();
    expect(state.knockoutMatches["QF-97"].team2Id).toBeNull();
  });

  it("clicking selected team (SET_KNOCKOUT_WINNER with same winnerId) clears the winner", () => {
    const state = createInitialState(null);
    const winner = state.groupOrders.A[1];
    const withWinner = predictionReducer(state, {
      type: "SET_KNOCKOUT_WINNER",
      matchId: "R32-73",
      winnerId: winner,
    });
    expect(withWinner.knockoutMatches["R32-73"].winnerId).toBe(winner);
    // Clicking the same team again — UI dispatches CLEAR_KNOCKOUT_WINNER (handled by component)
    const cleared = predictionReducer(withWinner, {
      type: "CLEAR_KNOCKOUT_WINNER",
      matchId: "R32-73",
    });
    expect(cleared.knockoutMatches["R32-73"].winnerId).toBeNull();
  });
});

describe("getOrderedThirdPlaceTeams", () => {
  it("returns 12 teams", () => {
    const state = createInitialState(null);
    const teams = getOrderedThirdPlaceTeams(state, "en");
    expect(teams).toHaveLength(12);
  });

  it("each team id is the 3rd-place slot id (3rd-a format)", () => {
    const state = createInitialState(null);
    const teams = getOrderedThirdPlaceTeams(state, "en");
    for (const team of teams) {
      expect(team.id).toMatch(/^3rd-[a-l]$/);
    }
  });

  it("reflects changed group order — team at position 3 becomes the 3rd-place entry", () => {
    const state = createInitialState(null);
    const groupA = state.groupOrders.A;
    const movedLast = predictionReducer(state, {
      type: "SET_GROUP_ORDER",
      groupName: "A",
      orderedIds: [groupA[1], groupA[2], groupA[0], groupA[3]],
    });
    const teams = getOrderedThirdPlaceTeams(movedLast, "en");
    const thirdA = teams.find((t) => t.id === "3rd-a");
    expect(thirdA?.originalId).toBe(groupA[0]);
  });
});

describe("getAllTeamsLookup", () => {
  it("returns the same Map instance on repeated calls with the same locale (module-level cache)", () => {
    const first = getAllTeamsLookup("en");
    const second = getAllTeamsLookup("en");
    expect(first).toBe(second);
  });

  it("returns different Map instances for different locales", () => {
    const en = getAllTeamsLookup("en");
    const es = getAllTeamsLookup("es");
    expect(en).not.toBe(es);
  });

  it("contains all 48 teams", () => {
    const lookup = getAllTeamsLookup("en");
    expect(lookup.size).toBe(48);
  });
});
