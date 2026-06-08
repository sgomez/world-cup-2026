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

describe("Bet.updatePredictions", () => {
  const newGroupPredictions = {
    groupOrders: { A: ["mex", "rsa"] },
    thirdPlaceOrder: ["3rd-a"],
  };
  const newKnockoutWinners = { M0: "mex", M1: "rsa" };

  it("rejects PAST_DEADLINE when the window is closed", () => {
    const result = Bet.fromState(betState()).updatePredictions(
      newGroupPredictions,
      newKnockoutWinners,
      OPEN,
      AFTER,
    );
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("PAST_DEADLINE");
  });

  it("rejects BET_CLOSED when the bet is closed", () => {
    const result = Bet.fromState(
      betState({ status: "closed" }),
    ).updatePredictions(newGroupPredictions, newKnockoutWinners, OPEN, BEFORE);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("BET_CLOSED");
  });

  it("replaces groupPredictions and knockoutWinners on a draft within the window", () => {
    const result = Bet.fromState(betState()).updatePredictions(
      newGroupPredictions,
      newKnockoutWinners,
      OPEN,
      BEFORE,
    );
    expect(result.isOk()).toBe(true);
    const state = result._unsafeUnwrap().toState();
    expect(state.groupPredictions).toEqual(newGroupPredictions);
    expect(state.knockoutWinners).toEqual(newKnockoutWinners);
  });

  it("accepts null groupPredictions", () => {
    const result = Bet.fromState(betState()).updatePredictions(
      null,
      newKnockoutWinners,
      OPEN,
      BEFORE,
    );
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().toState().groupPredictions).toBeNull();
  });

  it("does not mutate the original aggregate", () => {
    const bet = Bet.fromState(betState({ groupPredictions: null }));
    bet.updatePredictions(
      newGroupPredictions,
      newKnockoutWinners,
      OPEN,
      BEFORE,
    );
    expect(bet.toState().groupPredictions).toBeNull();
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

describe("Bet.create", () => {
  it("rejects PAST_DEADLINE when the window is closed", () => {
    const result = Bet.create("New label", "user-1", OPEN, AFTER);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("PAST_DEADLINE");
  });

  it("rejects INVALID_LABEL for empty or too long labels", () => {
    const result1 = Bet.create("", "user-1", OPEN, BEFORE);
    expect(result1.isErr()).toBe(true);
    expect(result1._unsafeUnwrapErr().code).toBe("INVALID_LABEL");

    const result2 = Bet.create("a".repeat(201), "user-1", OPEN, BEFORE);
    expect(result2.isErr()).toBe(true);
    expect(result2._unsafeUnwrapErr().code).toBe("INVALID_LABEL");
  });

  it("creates a new draft bet when window is open and label is valid", () => {
    const result = Bet.create("  Valid Label  ", "user-1", OPEN, BEFORE);
    expect(result.isOk()).toBe(true);
    const bet = result._unsafeUnwrap();
    expect(bet.userId).toBe("user-1");
    expect(bet.status).toBe("draft");
    expect(bet.label).toBe("Valid Label");
    expect(bet.groupPredictions).toBeNull();
    expect(bet.knockoutWinners).toEqual({});
    expect(bet.id).toBeDefined();
  });
});

describe("Bet.copyFrom", () => {
  it("rejects PAST_DEADLINE when the window is closed", () => {
    const source = Bet.fromState(betState({ label: "Source" }));
    const result = Bet.copyFrom(source, "user-2", OPEN, AFTER);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("PAST_DEADLINE");
  });

  it("copies predictions, prefixes 'Copy of ', and truncates to 200 characters", () => {
    const groupPredictions = {
      groupOrders: { A: ["mex"] },
      thirdPlaceOrder: ["3rd-a"],
    };
    const knockoutWinners = { "R32-73": "mex" };
    const source = Bet.fromState(
      betState({
        label: "A".repeat(197),
        groupPredictions,
        knockoutWinners,
      }),
    );
    const result = Bet.copyFrom(source, "user-2", OPEN, BEFORE);
    expect(result.isOk()).toBe(true);
    const copied = result._unsafeUnwrap();
    expect(copied.userId).toBe("user-2");
    expect(copied.status).toBe("draft");
    expect(copied.groupPredictions).toEqual(groupPredictions);
    expect(copied.knockoutWinners).toEqual(knockoutWinners);
    expect(copied.label.length).toBe(200);
    expect(copied.label).toBe(`Copy of ${"A".repeat(197)}`.slice(0, 200));
  });
});

describe("Bet.peerVisibility", () => {
  it("returns 'full' past the deadline for closed bets, but 'hidden' for draft bets", () => {
    const window = new BettingWindow(DEADLINE);
    const draftBet = Bet.fromState(betState({ status: "draft" }));
    const closedBet = Bet.fromState(betState({ status: "closed" }));
    expect(draftBet.peerVisibility(window, AFTER)).toBe("hidden");
    expect(closedBet.peerVisibility(window, AFTER)).toBe("full");
  });

  it("returns 'summary' for closed bets before the deadline", () => {
    const window = new BettingWindow(DEADLINE);
    const closedBet = Bet.fromState(betState({ status: "closed" }));
    expect(closedBet.peerVisibility(window, BEFORE)).toBe("summary");
  });

  it("returns 'hidden' for draft bets before the deadline", () => {
    const window = new BettingWindow(DEADLINE);
    const draftBet = Bet.fromState(betState({ status: "draft" }));
    expect(draftBet.peerVisibility(window, BEFORE)).toBe("hidden");
  });

  it("returns 'summary' for closed bets exactly at the deadline", () => {
    const window = new BettingWindow(DEADLINE);
    const closedBet = Bet.fromState(betState({ status: "closed" }));
    expect(closedBet.peerVisibility(window, DEADLINE)).toBe("summary");
  });

  it("returns 'hidden' for draft bets exactly at the deadline", () => {
    const window = new BettingWindow(DEADLINE);
    const draftBet = Bet.fromState(betState({ status: "draft" }));
    expect(draftBet.peerVisibility(window, DEADLINE)).toBe("hidden");
  });
});
