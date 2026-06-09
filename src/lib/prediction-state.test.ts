import { describe, expect, it } from "vitest";
import combinationsData from "../../data/worldcup.combinations.json";
import {
  computeR32Matches,
  createInitialState,
  getAllTeamsLookup,
  getOrderedThirdPlaceTeams,
  predictionReducer,
  type TournamentState,
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

function createStateWithSF(state: TournamentState) {
  const team2A = state.groupOrders.A[1];
  const team1E = state.groupOrders.E[0];
  const team1F = state.groupOrders.F[0];
  const team1I = state.groupOrders.I[0];
  const team2K = state.groupOrders.K[1];
  const team1H = state.groupOrders.H[0];
  const team1D = state.groupOrders.D[0];
  const team1G = state.groupOrders.G[0];

  const winners = {
    "R32-73": team2A,
    "R32-74": team1E,
    "R32-75": team1F,
    "R32-77": team1I,
    "R16-89": team1E,
    "R16-90": team2A,
    "QF-97": team2A,

    "R32-83": team2K,
    "R32-84": team1H,
    "R16-93": team2K,
    "R32-81": team1D,
    "R32-82": team1G,
    "R16-94": team1D,
    "QF-98": team1D,
  };

  return createInitialState(
    { groupOrders: state.groupOrders, thirdPlaceOrder: state.thirdPlaceOrder },
    winners,
  );
}

function createStateWithSF102(state: TournamentState) {
  const team1C = state.groupOrders.C[0];
  const team2E = state.groupOrders.E[1];
  const team1A = state.groupOrders.A[0];
  const team1L = state.groupOrders.L[0];
  const team1J = state.groupOrders.J[0];
  const team2D = state.groupOrders.D[1];
  const team1B = state.groupOrders.B[0];
  const team1K = state.groupOrders.K[0];

  const winners = {
    "R32-76": team1C,
    "R32-78": team2E,
    "R16-91": team1C,
    "R32-79": team1A,
    "R32-80": team1L,
    "R16-92": team1A,
    "QF-99": team1A,

    "R32-86": team1J,
    "R32-88": team2D,
    "R16-95": team1J,
    "R32-85": team1B,
    "R32-87": team1K,
    "R16-96": team1B,
    "QF-100": team1B,
  };

  return createInitialState(
    { groupOrders: state.groupOrders, thirdPlaceOrder: state.thirdPlaceOrder },
    winners,
  );
}

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
    const [_a0, a1] = state.groupOrders.A;
    const b1 = state.groupOrders.B[1];
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

    // Now, change the winner of R32-73 to b1 (the other valid participant)
    state = predictionReducer(state, {
      type: "SET_KNOCKOUT_WINNER",
      matchId: "R32-73",
      winnerId: b1,
    });

    // R32-73 winner should be b1
    expect(state.knockoutMatches["R32-73"].winnerId).toBe(b1);
    // R16-90 team1Id should be b1
    expect(state.knockoutMatches["R16-90"].team1Id).toBe(b1);
    // R16-90 winnerId should be cleared (null) since a1 is no longer in R16-90!
    expect(state.knockoutMatches["R16-90"].winnerId).toBeNull();
    // QF-97 team2Id should be cleared (null)
    expect(state.knockoutMatches["QF-97"].team2Id).toBeNull();
  });

  it("SET_KNOCKOUT_WINNER for SF-101 sets loser in 3RD match slot 1", () => {
    const initialState = createInitialState(null);
    const stateWithSF = createStateWithSF(initialState);
    const team1 = stateWithSF.knockoutMatches["SF-101"].team1Id as string;
    const team2 = stateWithSF.knockoutMatches["SF-101"].team2Id as string;

    const next = predictionReducer(stateWithSF, {
      type: "SET_KNOCKOUT_WINNER",
      matchId: "SF-101",
      winnerId: team1,
    });
    expect(next.knockoutMatches["SF-101"].winnerId).toBe(team1);
    expect(next.knockoutMatches["SF-101"].loserId).toBe(team2);
    expect(next.knockoutMatches["3RD"].team1Id).toBe(team2); // loser goes to 3RD slot 1
    expect(next.knockoutMatches.F.team1Id).toBe(team1); // winner goes to Final slot 1
  });

  it("SET_KNOCKOUT_WINNER for SF-102 sets loser in 3RD match slot 2 and winner in Final slot 2", () => {
    const initialState = createInitialState(null);
    const stateWithSF = createStateWithSF102(initialState);
    const team1 = stateWithSF.knockoutMatches["SF-102"].team1Id as string;
    const team2 = stateWithSF.knockoutMatches["SF-102"].team2Id as string;

    const next = predictionReducer(stateWithSF, {
      type: "SET_KNOCKOUT_WINNER",
      matchId: "SF-102",
      winnerId: team2,
    });
    expect(next.knockoutMatches["3RD"].team2Id).toBe(team1); // loser → 3RD slot 2
    expect(next.knockoutMatches.F.team2Id).toBe(team2); // winner → Final slot 2
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

  it("TDD: failing test first — fill a full bracket, then via a group reorder eliminate a semifinal loser; assert the 3rd-place match is cleared", () => {
    let state = createInitialState(null);

    // Group D's original teams. 1D is groupOrders.D[0], which is 1D.
    const team1D = state.groupOrders.D[0];

    const team2A = state.groupOrders.A[1];
    const team1F = state.groupOrders.F[0];
    const team1E = state.groupOrders.E[0];
    const team1I = state.groupOrders.I[0];
    const team2K = state.groupOrders.K[1];
    const team1H = state.groupOrders.H[0];
    const team1G = state.groupOrders.G[0];

    const actions = [
      {
        type: "SET_KNOCKOUT_WINNER" as const,
        matchId: "R32-73",
        winnerId: team2A,
      },
      {
        type: "SET_KNOCKOUT_WINNER" as const,
        matchId: "R32-74",
        winnerId: team1E,
      },
      {
        type: "SET_KNOCKOUT_WINNER" as const,
        matchId: "R32-75",
        winnerId: team1F,
      },
      {
        type: "SET_KNOCKOUT_WINNER" as const,
        matchId: "R32-77",
        winnerId: team1I,
      },
      {
        type: "SET_KNOCKOUT_WINNER" as const,
        matchId: "R16-89",
        winnerId: team1E,
      },
      {
        type: "SET_KNOCKOUT_WINNER" as const,
        matchId: "R16-90",
        winnerId: team2A,
      },
      {
        type: "SET_KNOCKOUT_WINNER" as const,
        matchId: "QF-97",
        winnerId: team2A,
      },

      {
        type: "SET_KNOCKOUT_WINNER" as const,
        matchId: "R32-83",
        winnerId: team2K,
      },
      {
        type: "SET_KNOCKOUT_WINNER" as const,
        matchId: "R32-84",
        winnerId: team1H,
      },
      {
        type: "SET_KNOCKOUT_WINNER" as const,
        matchId: "R16-93",
        winnerId: team2K,
      },

      {
        type: "SET_KNOCKOUT_WINNER" as const,
        matchId: "R32-81",
        winnerId: team1D,
      },
      {
        type: "SET_KNOCKOUT_WINNER" as const,
        matchId: "R32-82",
        winnerId: team1G,
      },
      {
        type: "SET_KNOCKOUT_WINNER" as const,
        matchId: "R16-94",
        winnerId: team1D,
      },
      {
        type: "SET_KNOCKOUT_WINNER" as const,
        matchId: "QF-98",
        winnerId: team1D,
      },
    ];

    for (const action of actions) {
      state = predictionReducer(state, action);
    }

    expect(state.knockoutMatches["SF-101"].team1Id).toBe(team2A);
    expect(state.knockoutMatches["SF-101"].team2Id).toBe(team1D);

    state = predictionReducer(state, {
      type: "SET_KNOCKOUT_WINNER",
      matchId: "SF-101",
      winnerId: team2A,
    });

    expect(state.knockoutMatches["SF-101"].winnerId).toBe(team2A);
    expect(state.knockoutMatches["SF-101"].loserId).toBe(team1D);
    expect(state.knockoutMatches["3RD"].team1Id).toBe(team1D);

    state = predictionReducer(state, {
      type: "SET_KNOCKOUT_WINNER",
      matchId: "3RD",
      winnerId: team1D,
    });
    expect(state.knockoutMatches["3RD"].winnerId).toBe(team1D);

    const newGroupD = [...state.groupOrders.D];
    const temp = newGroupD[0];
    newGroupD[0] = newGroupD[3];
    newGroupD[3] = temp;

    state = predictionReducer(state, {
      type: "SET_GROUP_ORDER",
      groupName: "D",
      orderedIds: newGroupD,
    });

    expect(state.knockoutMatches["3RD"].team1Id).toBeNull();
    expect(state.knockoutMatches["3RD"].winnerId).toBeNull();

    expect(state.knockoutMatches["SF-101"].team2Id).toBeNull();
    expect(state.knockoutMatches["SF-101"].loserId).toBeNull();
  });

  it("TDD: failing test first — clear a quarter-final winner who was a semifinal loser; assert the 3rd-place match is cleared", () => {
    let state = createInitialState(null);

    const team2A = state.groupOrders.A[1];
    const team1D = state.groupOrders.D[0];
    const team1E = state.groupOrders.E[0];
    const team1F = state.groupOrders.F[0];
    const team1I = state.groupOrders.I[0];
    const team2K = state.groupOrders.K[1];
    const team1H = state.groupOrders.H[0];
    const team1G = state.groupOrders.G[0];

    const actions = [
      {
        type: "SET_KNOCKOUT_WINNER" as const,
        matchId: "R32-73",
        winnerId: team2A,
      },
      {
        type: "SET_KNOCKOUT_WINNER" as const,
        matchId: "R32-74",
        winnerId: team1E,
      },
      {
        type: "SET_KNOCKOUT_WINNER" as const,
        matchId: "R32-75",
        winnerId: team1F,
      },
      {
        type: "SET_KNOCKOUT_WINNER" as const,
        matchId: "R32-77",
        winnerId: team1I,
      },
      {
        type: "SET_KNOCKOUT_WINNER" as const,
        matchId: "R16-89",
        winnerId: team1E,
      },
      {
        type: "SET_KNOCKOUT_WINNER" as const,
        matchId: "R16-90",
        winnerId: team2A,
      },
      {
        type: "SET_KNOCKOUT_WINNER" as const,
        matchId: "QF-97",
        winnerId: team2A,
      },

      {
        type: "SET_KNOCKOUT_WINNER" as const,
        matchId: "R32-83",
        winnerId: team2K,
      },
      {
        type: "SET_KNOCKOUT_WINNER" as const,
        matchId: "R32-84",
        winnerId: team1H,
      },
      {
        type: "SET_KNOCKOUT_WINNER" as const,
        matchId: "R16-93",
        winnerId: team2K,
      },

      {
        type: "SET_KNOCKOUT_WINNER" as const,
        matchId: "R32-81",
        winnerId: team1D,
      },
      {
        type: "SET_KNOCKOUT_WINNER" as const,
        matchId: "R32-82",
        winnerId: team1G,
      },
      {
        type: "SET_KNOCKOUT_WINNER" as const,
        matchId: "R16-94",
        winnerId: team1D,
      },
      {
        type: "SET_KNOCKOUT_WINNER" as const,
        matchId: "QF-98",
        winnerId: team1D,
      },

      {
        type: "SET_KNOCKOUT_WINNER" as const,
        matchId: "SF-101",
        winnerId: team2A,
      },
      {
        type: "SET_KNOCKOUT_WINNER" as const,
        matchId: "3RD",
        winnerId: team1D,
      },
    ];

    for (const action of actions) {
      state = predictionReducer(state, action);
    }

    expect(state.knockoutMatches["SF-101"].loserId).toBe(team1D);
    expect(state.knockoutMatches["3RD"].team1Id).toBe(team1D);
    expect(state.knockoutMatches["3RD"].winnerId).toBe(team1D);

    state = predictionReducer(state, {
      type: "CLEAR_KNOCKOUT_WINNER",
      matchId: "QF-98",
    });

    expect(state.knockoutMatches["3RD"].team1Id).toBeNull();
    expect(state.knockoutMatches["3RD"].winnerId).toBeNull();

    expect(state.knockoutMatches["SF-101"].team2Id).toBeNull();
    expect(state.knockoutMatches["SF-101"].loserId).toBeNull();
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
