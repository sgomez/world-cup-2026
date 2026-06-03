import { describe, expect, it } from "vitest";
import {
  createInitialState,
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
});

describe("getOrderedThirdPlaceTeams", () => {
  it("returns 12 teams", () => {
    const state = createInitialState(null);
    const teams = getOrderedThirdPlaceTeams(state);
    expect(teams).toHaveLength(12);
  });

  it("each team id is the 3rd-place slot id (3rd-a format)", () => {
    const state = createInitialState(null);
    const teams = getOrderedThirdPlaceTeams(state);
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
    const teams = getOrderedThirdPlaceTeams(movedLast);
    const thirdA = teams.find((t) => t.id === "3rd-a");
    expect(thirdA?.originalId).toBe(groupA[0]);
  });
});
