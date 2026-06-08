import { describe, expect, it } from "vitest";
import { Bet } from "../domain/bet";
import { BettingWindow } from "../domain/betting-window";
import { InMemoryBetRepository } from "../infrastructure/in-memory-bet-repository";
import { copyBet } from "./copy-bet";

const DEADLINE = new Date("2026-06-11T19:00:00Z");
const BEFORE = new Date("2026-06-10T00:00:00Z");
const AFTER = new Date("2026-06-12T00:00:00Z");
const WINDOW = new BettingWindow(DEADLINE);
const OWNER = "user-1";

function sourceBet(overrides = {}) {
  return Bet.fromState({
    id: "source-1",
    userId: OWNER,
    status: "draft",
    label: "Original Bet",
    groupPredictions: {
      groupOrders: { A: ["mex"] },
      thirdPlaceOrder: ["3rd-a"],
    },
    knockoutWinners: { "R32-73": "mex" },
    ...overrides,
  });
}

describe("copyBet use-case", () => {
  it("returns NOT_FOUND when the source bet does not exist", async () => {
    const repo = new InMemoryBetRepository();
    const result = await copyBet(repo, {
      betId: "missing",
      userId: OWNER,
      limit: 3,
      window: WINDOW,
      now: BEFORE,
    });
    expect(result._unsafeUnwrapErr().code).toBe("NOT_FOUND");
  });

  it("returns FORBIDDEN when the caller does not own the source bet", async () => {
    const repo = new InMemoryBetRepository([sourceBet()]);
    const result = await copyBet(repo, {
      betId: "source-1",
      userId: "someone-else",
      limit: 3,
      window: WINDOW,
      now: BEFORE,
    });
    expect(result._unsafeUnwrapErr().code).toBe("FORBIDDEN");
  });

  it("returns PAST_DEADLINE when the window is closed", async () => {
    const repo = new InMemoryBetRepository([sourceBet()]);
    const result = await copyBet(repo, {
      betId: "source-1",
      userId: OWNER,
      limit: 3,
      window: WINDOW,
      now: AFTER,
    });
    expect(result._unsafeUnwrapErr().code).toBe("PAST_DEADLINE");
  });

  it("returns LIMIT_EXCEEDED when user has already reached the limit", async () => {
    const source = sourceBet();
    const otherBets = [
      Bet.fromState({
        id: "2",
        userId: OWNER,
        label: "b2",
        status: "draft",
        knockoutWinners: {},
        groupPredictions: null,
      }),
      Bet.fromState({
        id: "3",
        userId: OWNER,
        label: "b3",
        status: "draft",
        knockoutWinners: {},
        groupPredictions: null,
      }),
    ];
    const repo = new InMemoryBetRepository([source, ...otherBets]);
    const result = await copyBet(repo, {
      betId: "source-1",
      userId: OWNER,
      limit: 3,
      window: WINDOW,
      now: BEFORE,
    });
    expect(result._unsafeUnwrapErr().code).toBe("LIMIT_EXCEEDED");
  });

  it("copies predictions, prefixes label with 'Copy of ', and saves the new bet", async () => {
    const source = sourceBet();
    const repo = new InMemoryBetRepository([source]);
    const result = await copyBet(repo, {
      betId: "source-1",
      userId: OWNER,
      limit: 3,
      window: WINDOW,
      now: BEFORE,
    });
    expect(result.isOk()).toBe(true);
    const copied = result._unsafeUnwrap();
    expect(copied.id).not.toBe(source.id);
    expect(copied.userId).toBe(OWNER);
    expect(copied.label).toBe("Copy of Original Bet");
    expect(copied.groupPredictions).toEqual(source.groupPredictions);
    expect(copied.knockoutWinners).toEqual(source.knockoutWinners);

    const saved = await repo.findById(copied.id);
    expect(saved).toBeDefined();
    expect(saved?.label).toBe("Copy of Original Bet");
  });
});
