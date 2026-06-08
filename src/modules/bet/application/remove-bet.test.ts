import { describe, expect, it } from "vitest";
import { Bet, type BetState } from "../domain/bet";
import { BettingWindow } from "../domain/betting-window";
import { InMemoryBetRepository } from "../infrastructure/in-memory-bet-repository";
import { removeBet } from "./remove-bet";

const DEADLINE = new Date("2026-06-11T19:00:00Z");
const BEFORE = new Date("2026-06-10T00:00:00Z");
const AFTER = new Date("2026-06-12T00:00:00Z");
const WINDOW = new BettingWindow(DEADLINE);
const OWNER = "user-1";

function bet(overrides: Partial<BetState> = {}): Bet {
  return Bet.fromState({
    id: "bet-1",
    userId: OWNER,
    status: "draft",
    label: "My bet",
    groupPredictions: null,
    knockoutWinners: {},
    ...overrides,
  });
}

describe("removeBet use-case", () => {
  it("returns NOT_FOUND when the bet does not exist", async () => {
    const repo = new InMemoryBetRepository();
    const result = await removeBet(repo, {
      betId: "missing",
      userId: OWNER,
      window: WINDOW,
      now: BEFORE,
    });
    expect(result._unsafeUnwrapErr().code).toBe("NOT_FOUND");
  });

  it("returns FORBIDDEN when the caller does not own the bet", async () => {
    const repo = new InMemoryBetRepository([bet()]);
    const result = await removeBet(repo, {
      betId: "bet-1",
      userId: "someone-else",
      window: WINDOW,
      now: BEFORE,
    });
    expect(result._unsafeUnwrapErr().code).toBe("FORBIDDEN");
  });

  it("distinguishes NOT_FOUND from FORBIDDEN", async () => {
    const repo = new InMemoryBetRepository([bet()]);
    const missing = await removeBet(repo, {
      betId: "missing",
      userId: "someone-else",
      window: WINDOW,
      now: BEFORE,
    });
    expect(missing._unsafeUnwrapErr().code).toBe("NOT_FOUND");
  });

  it("returns PAST_DEADLINE when the window is closed", async () => {
    const repo = new InMemoryBetRepository([bet()]);
    const result = await removeBet(repo, {
      betId: "bet-1",
      userId: OWNER,
      window: WINDOW,
      now: AFTER,
    });
    expect(result._unsafeUnwrapErr().code).toBe("PAST_DEADLINE");
  });

  it("removes the bet in any status before the deadline", async () => {
    const repo = new InMemoryBetRepository([bet({ status: "closed" })]);
    const result = await removeBet(repo, {
      betId: "bet-1",
      userId: OWNER,
      window: WINDOW,
      now: BEFORE,
    });
    expect(result.isOk()).toBe(true);
    expect(await repo.findById("bet-1")).toBeNull();
  });
});
