import { describe, expect, it } from "vitest";
import {
  Bet,
  type BetState,
  type GroupPredictions,
  type KnockoutWinners,
} from "../domain/bet";
import { BettingWindow } from "../domain/betting-window";
import { InMemoryBetRepository } from "../infrastructure/in-memory-bet-repository";
import { updateBetPredictions } from "./update-bet-predictions";

const DEADLINE = new Date("2026-06-11T19:00:00Z");
const BEFORE = new Date("2026-06-10T00:00:00Z");
const AFTER = new Date("2026-06-12T00:00:00Z");
const WINDOW = new BettingWindow(DEADLINE);
const OWNER = "user-1";

const GROUP: GroupPredictions = {
  groupOrders: { A: ["mex", "rsa"] },
  thirdPlaceOrder: ["3rd-a"],
};
const KNOCKOUT: KnockoutWinners = { M0: "mex" };

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

describe("updateBetPredictions use-case", () => {
  it("returns NOT_FOUND when the bet does not exist", async () => {
    const repo = new InMemoryBetRepository();
    const result = await updateBetPredictions(repo, {
      betId: "missing",
      userId: OWNER,
      window: WINDOW,
      now: BEFORE,
      groupPredictions: GROUP,
      knockoutWinners: KNOCKOUT,
    });
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("NOT_FOUND");
  });

  it("returns FORBIDDEN when the caller does not own the bet", async () => {
    const repo = new InMemoryBetRepository([bet()]);
    const result = await updateBetPredictions(repo, {
      betId: "bet-1",
      userId: "someone-else",
      window: WINDOW,
      now: BEFORE,
      groupPredictions: GROUP,
      knockoutWinners: KNOCKOUT,
    });
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("FORBIDDEN");
  });

  it("distinguishes NOT_FOUND from FORBIDDEN", async () => {
    const repo = new InMemoryBetRepository([bet()]);
    const missing = await updateBetPredictions(repo, {
      betId: "missing",
      userId: "someone-else",
      window: WINDOW,
      now: BEFORE,
      groupPredictions: GROUP,
      knockoutWinners: KNOCKOUT,
    });
    expect(missing._unsafeUnwrapErr().code).toBe("NOT_FOUND");
  });

  it("returns PAST_DEADLINE when the window is closed", async () => {
    const repo = new InMemoryBetRepository([bet()]);
    const result = await updateBetPredictions(repo, {
      betId: "bet-1",
      userId: OWNER,
      window: WINDOW,
      now: AFTER,
      groupPredictions: GROUP,
      knockoutWinners: KNOCKOUT,
    });
    expect(result._unsafeUnwrapErr().code).toBe("PAST_DEADLINE");
  });

  it("returns BET_CLOSED when the bet is closed", async () => {
    const repo = new InMemoryBetRepository([bet({ status: "closed" })]);
    const result = await updateBetPredictions(repo, {
      betId: "bet-1",
      userId: OWNER,
      window: WINDOW,
      now: BEFORE,
      groupPredictions: GROUP,
      knockoutWinners: KNOCKOUT,
    });
    expect(result._unsafeUnwrapErr().code).toBe("BET_CLOSED");
  });

  it("saves updated predictions and returns ok", async () => {
    const repo = new InMemoryBetRepository([bet()]);
    const result = await updateBetPredictions(repo, {
      betId: "bet-1",
      userId: OWNER,
      window: WINDOW,
      now: BEFORE,
      groupPredictions: GROUP,
      knockoutWinners: KNOCKOUT,
    });
    expect(result.isOk()).toBe(true);
    const saved = await repo.findById("bet-1");
    expect(saved?.toState().groupPredictions).toEqual(GROUP);
    expect(saved?.toState().knockoutWinners).toEqual(KNOCKOUT);
  });

  it("persists null groupPredictions", async () => {
    const repo = new InMemoryBetRepository([bet({ groupPredictions: GROUP })]);
    const result = await updateBetPredictions(repo, {
      betId: "bet-1",
      userId: OWNER,
      window: WINDOW,
      now: BEFORE,
      groupPredictions: null,
      knockoutWinners: KNOCKOUT,
    });
    expect(result.isOk()).toBe(true);
    const saved = await repo.findById("bet-1");
    expect(saved?.toState().groupPredictions).toBeNull();
  });
});
