import { describe, expect, it } from "vitest";
import combinationsData from "../../../data/worldcup.combinations.json";
import {
  computeR32Matches,
  createInitialState,
  type TournamentState,
} from "./index";

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

describe("rebuildKnockoutMatches / cascade behaviour", () => {
  it("SET_KNOCKOUT_WINNER propagates winner to next match slot", () => {
    const state = createInitialState(null);
    const winner = state.groupOrders.A[1]; // 2A
    // R32-73 → R16-90 slot 1
    const restored = createInitialState(
      {
        groupOrders: state.groupOrders,
        thirdPlaceOrder: state.thirdPlaceOrder,
      },
      { "R32-73": winner },
    );
    expect(restored.knockoutMatches["R32-73"].winnerId).toBe(winner);
    expect(restored.knockoutMatches["R32-73"].loserId).toBe(
      state.groupOrders.B[1],
    );
    expect(restored.knockoutMatches["R16-90"].team1Id).toBe(winner);
  });

  it("winner propagates through R16 to QF", () => {
    const state = createInitialState(null);
    const team2A = state.groupOrders.A[1];
    const team1F = state.groupOrders.F[0];
    const restored = createInitialState(
      {
        groupOrders: state.groupOrders,
        thirdPlaceOrder: state.thirdPlaceOrder,
      },
      { "R32-73": team2A, "R32-75": team1F, "R16-90": team2A },
    );
    expect(restored.knockoutMatches["R16-90"].winnerId).toBe(team2A);
    expect(restored.knockoutMatches["QF-97"].team2Id).toBe(team2A);
  });

  it("SF winner goes to Final slot, loser goes to 3rd place match", () => {
    const initialState = createInitialState(null);
    const stateWithSF = createStateWithSF(initialState);
    const team1 = stateWithSF.knockoutMatches["SF-101"].team1Id as string;
    const team2 = stateWithSF.knockoutMatches["SF-101"].team2Id as string;

    const withSFWinner = createInitialState(
      {
        groupOrders: stateWithSF.groupOrders,
        thirdPlaceOrder: stateWithSF.thirdPlaceOrder,
      },
      {
        ...Object.fromEntries(
          Object.entries(stateWithSF.knockoutMatches)
            .filter(([, m]) => m.winnerId)
            .map(([id, m]) => [id, m.winnerId as string]),
        ),
        "SF-101": team1,
      },
    );
    expect(withSFWinner.knockoutMatches["SF-101"].winnerId).toBe(team1);
    expect(withSFWinner.knockoutMatches["SF-101"].loserId).toBe(team2);
    expect(withSFWinner.knockoutMatches["3RD"].team1Id).toBe(team2); // loser → 3RD slot 1
    expect(withSFWinner.knockoutMatches.F.team1Id).toBe(team1); // winner → Final slot 1
  });

  it("SF-102 winner goes to Final slot 2, loser goes to 3RD slot 2", () => {
    const initialState = createInitialState(null);
    const stateWithSF = createStateWithSF102(initialState);
    const team1 = stateWithSF.knockoutMatches["SF-102"].team1Id as string;
    const team2 = stateWithSF.knockoutMatches["SF-102"].team2Id as string;

    const withSFWinner = createInitialState(
      {
        groupOrders: stateWithSF.groupOrders,
        thirdPlaceOrder: stateWithSF.thirdPlaceOrder,
      },
      {
        ...Object.fromEntries(
          Object.entries(stateWithSF.knockoutMatches)
            .filter(([, m]) => m.winnerId)
            .map(([id, m]) => [id, m.winnerId as string]),
        ),
        "SF-102": team2,
      },
    );
    expect(withSFWinner.knockoutMatches["3RD"].team2Id).toBe(team1); // loser → 3RD slot 2
    expect(withSFWinner.knockoutMatches.F.team2Id).toBe(team2); // winner → Final slot 2
  });

  it("stale winner is discarded when team is no longer in the match", () => {
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
});

describe("client-bundle guard", () => {
  it("bracket module imports no server-only or Prisma symbols", async () => {
    // If this import throws (e.g. due to 'server-only'), the test fails.
    // This guard ensures the module remains isomorphic and safe for client bundles
    // (e.g. prediction components import it in the browser bundle).
    const mod = await import("./index");
    expect(typeof mod.rebuildKnockoutMatches).toBe("function");
    expect(typeof mod.createInitialState).toBe("function");
    expect(typeof mod.cascadeClearWinner).toBe("function");
    expect(typeof mod.applyWinnerToMatches).toBe("function");
    expect(typeof mod.extractWinners).toBe("function");
    expect(typeof mod.computeR32Matches).toBe("function");
    expect(typeof mod.createEmptyKnockoutMatches).toBe("function");
    expect(Array.isArray(mod.ROUND_ORDER)).toBe(true);
    expect(typeof mod.KNOCKOUT_MATCH_IDS).toBe("object");
  });
});
