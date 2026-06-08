import { describe, expect, it } from "vitest";
import { Bet, type BetState } from "../domain/bet";
import { BettingWindow } from "../domain/betting-window";
import { InMemoryBetRepository } from "../infrastructure/in-memory-bet-repository";
import { renameBet } from "./rename-bet";

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
    label: "Old label",
    groupPredictions: null,
    knockoutWinners: {},
    ...overrides,
  });
}

describe("renameBet use-case", () => {
  it("returns NOT_FOUND when the bet does not exist", async () => {
    const repo = new InMemoryBetRepository();
    const result = await renameBet(repo, {
      betId: "missing",
      userId: OWNER,
      label: "New label",
      window: WINDOW,
      now: BEFORE,
    });
    expect(result._unsafeUnwrapErr().code).toBe("NOT_FOUND");
  });

  it("returns FORBIDDEN when the caller does not own the bet", async () => {
    const repo = new InMemoryBetRepository([bet()]);
    const result = await renameBet(repo, {
      betId: "bet-1",
      userId: "someone-else",
      label: "New label",
      window: WINDOW,
      now: BEFORE,
    });
    expect(result._unsafeUnwrapErr().code).toBe("FORBIDDEN");
  });

  it("distinguishes NOT_FOUND from FORBIDDEN", async () => {
    const repo = new InMemoryBetRepository([bet()]);
    const missing = await renameBet(repo, {
      betId: "missing",
      userId: "someone-else",
      label: "New label",
      window: WINDOW,
      now: BEFORE,
    });
    expect(missing._unsafeUnwrapErr().code).toBe("NOT_FOUND");
  });

  it("returns PAST_DEADLINE when the window is closed", async () => {
    const repo = new InMemoryBetRepository([bet()]);
    const result = await renameBet(repo, {
      betId: "bet-1",
      userId: OWNER,
      label: "New label",
      window: WINDOW,
      now: AFTER,
    });
    expect(result._unsafeUnwrapErr().code).toBe("PAST_DEADLINE");
  });

  it("returns BET_CLOSED when the bet is not a draft", async () => {
    const repo = new InMemoryBetRepository([bet({ status: "closed" })]);
    const result = await renameBet(repo, {
      betId: "bet-1",
      userId: OWNER,
      label: "New label",
      window: WINDOW,
      now: BEFORE,
    });
    expect(result._unsafeUnwrapErr().code).toBe("BET_CLOSED");
  });

  it("returns INVALID_LABEL for an empty label", async () => {
    const repo = new InMemoryBetRepository([bet()]);
    const result = await renameBet(repo, {
      betId: "bet-1",
      userId: OWNER,
      label: "",
      window: WINDOW,
      now: BEFORE,
    });
    expect(result._unsafeUnwrapErr().code).toBe("INVALID_LABEL");
  });

  it("renames the bet and persists the new label", async () => {
    const repo = new InMemoryBetRepository([bet()]);
    const result = await renameBet(repo, {
      betId: "bet-1",
      userId: OWNER,
      label: "New label",
      window: WINDOW,
      now: BEFORE,
    });
    expect(result.isOk()).toBe(true);
    const saved = await repo.findById("bet-1");
    expect(saved?.toState().label).toBe("New label");
  });
});
