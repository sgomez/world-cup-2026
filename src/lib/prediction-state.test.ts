import { describe, expect, it } from "vitest";
import combinationsData from "../../data/worldcup.combinations.json";
import { computeR32Matches, createInitialState } from "./prediction-state";

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
