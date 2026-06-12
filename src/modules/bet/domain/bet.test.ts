import { describe, expect, it } from "vitest";
import { computeSignatureFromContent } from "@/lib/bet-signature";
import { type ScoreableContentArrays, toScoreableContent } from "@/lib/scoring";
import { getGroups } from "@/lib/teams";
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
    directPredictions: null,
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

describe("Direct Bets", () => {
  function validDirectPredictions(): ScoreableContentArrays {
    const teams = getGroups("en").flatMap((g) => g.teams.map((t) => t.id));
    const R32 = teams.slice(0, 32);
    const R16 = R32.slice(0, 16);
    const QF = R16.slice(0, 8);
    const SF = QF.slice(0, 4);
    const F = SF.slice(0, 2);
    const champion = F[0];
    const thirdPlace = SF[2];
    return { R32, R16, QF, SF, F, champion, thirdPlace };
  }

  it("creates a closed bet for a valid Direct Prediction", () => {
    const preds = validDirectPredictions();
    const result = Bet.createDirect("Direct Bet", "user-1", preds);
    expect(result.isOk()).toBe(true);
    const bet = result._unsafeUnwrap();
    expect(bet.userId).toBe("user-1");
    expect(bet.status).toBe("closed");
    expect(bet.label).toBe("Direct Bet");
    expect(bet.groupPredictions).toBeNull();
    expect(bet.knockoutWinners).toEqual({});
    expect(bet.directPredictions).toEqual(preds);
  });

  it("rejects wrong round size", () => {
    const preds = validDirectPredictions();
    const invalidPreds = { ...preds, R32: preds.R32.slice(0, 31) };
    const result = Bet.createDirect("Direct Bet", "user-1", invalidPreds);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("INVALID_PREDICTIONS");
  });

  it("rejects missing champion or third-place", () => {
    const preds = validDirectPredictions();
    const noChamp = { ...preds, champion: null };
    const noThird = { ...preds, thirdPlace: null };
    expect(Bet.createDirect("Direct Bet", "user-1", noChamp).isErr()).toBe(
      true,
    );
    expect(Bet.createDirect("Direct Bet", "user-1", noThird).isErr()).toBe(
      true,
    );
  });

  it("rejects broken nesting", () => {
    const preds = validDirectPredictions();
    // Replace one F team with a team not in SF (e.g. index 31 of R32)
    const brokenF = { ...preds, F: [preds.SF[0], preds.R32[30]] };
    const result = Bet.createDirect("Direct Bet", "user-1", brokenF);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("INVALID_PREDICTIONS");
  });

  it("rejects champion not in Final", () => {
    const preds = validDirectPredictions();
    const brokenChamp = { ...preds, champion: preds.SF[2] };
    const result = Bet.createDirect("Direct Bet", "user-1", brokenChamp);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("INVALID_PREDICTIONS");
  });

  it("rejects third-place not in Semi-finals", () => {
    const preds = validDirectPredictions();
    const brokenThird = { ...preds, thirdPlace: preds.R32[30] };
    const result = Bet.createDirect("Direct Bet", "user-1", brokenThird);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("INVALID_PREDICTIONS");
  });

  it("rejects unknown team", () => {
    const preds = validDirectPredictions();
    const unknownF = { ...preds, F: [preds.SF[0], "unknown"] };
    const result = Bet.createDirect("Direct Bet", "user-1", unknownF);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("INVALID_PREDICTIONS");
  });

  it("enforces groupPredictions XOR directPredictions", () => {
    const preds = validDirectPredictions();
    expect(() => {
      Bet.fromState({
        id: "bet-1",
        userId: "user-1",
        status: "closed",
        label: "Direct Bet",
        groupPredictions: { groupOrders: {}, thirdPlaceOrder: [] },
        knockoutWinners: {},
        directPredictions: preds,
      });
    }).toThrow();
  });

  it("returns correct scoreableContent for Direct Bet", () => {
    const preds = validDirectPredictions();
    const bet = Bet.createDirect("Direct Bet", "user-1", preds)._unsafeUnwrap();
    expect(bet.scoreableContent()).toEqual(toScoreableContent(preds));
  });

  it("signature parity: identical prediction contents produce identical signature", () => {
    const preds = validDirectPredictions();
    const bet = Bet.createDirect("Direct Bet", "user-1", preds)._unsafeUnwrap();
    const sig = bet.signature;
    expect(sig).toBeDefined();

    const expectedSig = computeSignatureFromContent(toScoreableContent(preds));
    expect(sig).toBe(expectedSig);
  });

  it("rejects draft mutating actions on Direct Bets", () => {
    const preds = validDirectPredictions();
    const bet = Bet.createDirect("Direct Bet", "user-1", preds)._unsafeUnwrap();
    const window = new BettingWindow(DEADLINE);
    expect(bet.close(window, BEFORE).isErr()).toBe(true);
    expect(bet.reopen(window, BEFORE).isErr()).toBe(true);
    expect(bet.updatePredictions(null, {}, window, BEFORE).isErr()).toBe(true);
    expect(bet.rename("New Label", window, BEFORE).isErr()).toBe(true);
  });

  it("rejects third-place winner in the Final", () => {
    const preds = validDirectPredictions();
    const invalidPreds = { ...preds, thirdPlace: preds.F[0] };
    const result = Bet.createDirect("Direct Bet", "user-1", invalidPreds);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("INVALID_PREDICTIONS");
  });

  it("rejects non-array or non-string input values", () => {
    const preds = validDirectPredictions();
    const invalidPreds1 = { ...preds, R32: "not-an-array" as any };
    expect(
      Bet.createDirect("Direct Bet", "user-1", invalidPreds1).isErr(),
    ).toBe(true);

    const invalidPreds2 = {
      ...preds,
      R16: [...preds.R16.slice(0, 15), 42 as any],
    };
    expect(
      Bet.createDirect("Direct Bet", "user-1", invalidPreds2).isErr(),
    ).toBe(true);
  });
});
