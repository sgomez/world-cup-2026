import { describe, expect, it } from "vitest";
import { Bet, type BetState } from "./bet";
import { BettingWindow } from "./betting-window";

const DEADLINE = new Date("2026-06-11T19:00:00Z");
const BEFORE = new Date("2026-06-10T00:00:00Z");
const AFTER = new Date("2026-06-12T00:00:00Z");
const OPEN = new BettingWindow(DEADLINE);

function completeWinners(): Record<string, string> {
  return Object.fromEntries(
    Array.from({ length: 32 }, (_, i) => [`M${i}`, `team-${i}`]),
  );
}

function betState(overrides: Partial<BetState> = {}): BetState {
  return {
    id: "bet-1",
    userId: "user-1",
    status: "draft",
    label: "My bet",
    groupPredictions: null,
    knockoutWinners: completeWinners(),
    ...overrides,
  };
}

describe("Bet.isOwnedBy", () => {
  it("is true for the owner", () => {
    expect(Bet.fromState(betState()).isOwnedBy("user-1")).toBe(true);
  });

  it("is false for anyone else", () => {
    expect(Bet.fromState(betState()).isOwnedBy("user-2")).toBe(false);
  });
});

describe("Bet.close", () => {
  it("rejects PAST_DEADLINE when the window is closed", () => {
    const result = Bet.fromState(betState()).close(OPEN, AFTER);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("PAST_DEADLINE");
  });

  it("rejects INCOMPLETE_PREDICTIONS with fewer than 32 winners", () => {
    const result = Bet.fromState(
      betState({ knockoutWinners: { M0: "team-0" } }),
    ).close(OPEN, BEFORE);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("INCOMPLETE_PREDICTIONS");
  });

  it("closes a complete draft within the window", () => {
    const result = Bet.fromState(betState()).close(OPEN, BEFORE);
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().status).toBe("closed");
  });

  it("does not mutate the original aggregate", () => {
    const bet = Bet.fromState(betState());
    bet.close(OPEN, BEFORE);
    expect(bet.status).toBe("draft");
  });

  it("preserves predictions and label so the signature is unchanged", () => {
    const winners = completeWinners();
    const state = betState({
      groupPredictions: {
        groupOrders: { A: ["mex"] },
        thirdPlaceOrder: ["3rd-a"],
      },
      knockoutWinners: winners,
    });
    const closed = Bet.fromState(state).close(OPEN, BEFORE)._unsafeUnwrap();
    expect(closed.toState()).toEqual({ ...state, status: "closed" });
  });
});
