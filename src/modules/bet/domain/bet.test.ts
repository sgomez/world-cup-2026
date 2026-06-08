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

describe("Bet.reopen", () => {
  it("rejects PAST_DEADLINE when the window is closed", () => {
    const result = Bet.fromState(betState({ status: "closed" })).reopen(
      OPEN,
      AFTER,
    );
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("PAST_DEADLINE");
  });

  it("reopens a closed bet to draft within the window", () => {
    const result = Bet.fromState(betState({ status: "closed" })).reopen(
      OPEN,
      BEFORE,
    );
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().status).toBe("draft");
  });

  it("does not mutate the original aggregate", () => {
    const bet = Bet.fromState(betState({ status: "closed" }));
    bet.reopen(OPEN, BEFORE);
    expect(bet.status).toBe("closed");
  });

  it("preserves predictions and label so the signature is unchanged", () => {
    const state = betState({
      status: "closed",
      groupPredictions: {
        groupOrders: { A: ["mex"] },
        thirdPlaceOrder: ["3rd-a"],
      },
    });
    const reopened = Bet.fromState(state).reopen(OPEN, BEFORE)._unsafeUnwrap();
    expect(reopened.toState()).toEqual({ ...state, status: "draft" });
  });
});

describe("Bet.rename", () => {
  it("rejects PAST_DEADLINE when the window is closed", () => {
    const result = Bet.fromState(betState()).rename("New label", OPEN, AFTER);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("PAST_DEADLINE");
  });

  it("rejects BET_CLOSED when the bet is not a draft", () => {
    const result = Bet.fromState(betState({ status: "closed" })).rename(
      "New label",
      OPEN,
      BEFORE,
    );
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("BET_CLOSED");
  });

  it("rejects INVALID_LABEL for an empty label", () => {
    const result = Bet.fromState(betState()).rename("", OPEN, BEFORE);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("INVALID_LABEL");
  });

  it("rejects INVALID_LABEL for a label over 200 chars", () => {
    const result = Bet.fromState(betState()).rename(
      "a".repeat(201),
      OPEN,
      BEFORE,
    );
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("INVALID_LABEL");
  });

  it("renames a draft bet before the deadline with a valid label", () => {
    const result = Bet.fromState(betState()).rename("New label", OPEN, BEFORE);
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().toState().label).toBe("New label");
  });

  it("trims whitespace in the new label", () => {
    const result = Bet.fromState(betState()).rename(
      "  Trimmed  ",
      OPEN,
      BEFORE,
    );
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().toState().label).toBe("Trimmed");
  });

  it("does not mutate the original aggregate", () => {
    const bet = Bet.fromState(betState({ label: "Old label" }));
    bet.rename("New label", OPEN, BEFORE);
    expect(bet.toState().label).toBe("Old label");
  });
});
