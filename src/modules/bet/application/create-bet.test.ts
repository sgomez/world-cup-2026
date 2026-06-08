import { describe, expect, it } from "vitest";
import { Bet } from "../domain/bet";
import { BettingWindow } from "../domain/betting-window";
import { InMemoryBetRepository } from "../infrastructure/in-memory-bet-repository";
import { createBet } from "./create-bet";

const DEADLINE = new Date("2026-06-11T19:00:00Z");
const BEFORE = new Date("2026-06-10T00:00:00Z");
const AFTER = new Date("2026-06-12T00:00:00Z");
const WINDOW = new BettingWindow(DEADLINE);
const OWNER = "user-1";

describe("createBet use-case", () => {
  it("returns PAST_DEADLINE when the window is closed", async () => {
    const repo = new InMemoryBetRepository();
    const result = await createBet(repo, {
      userId: OWNER,
      label: "My bet",
      limit: 3,
      window: WINDOW,
      now: AFTER,
    });
    expect(result._unsafeUnwrapErr().code).toBe("PAST_DEADLINE");
  });

  it("returns LIMIT_EXCEEDED when the user has already reached the limit", async () => {
    const seedBets = [
      Bet.fromState({
        id: "1",
        userId: OWNER,
        label: "b1",
        status: "draft",
        knockoutWinners: {},
        groupPredictions: null,
      }),
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
    const repo = new InMemoryBetRepository(seedBets);
    const result = await createBet(repo, {
      userId: OWNER,
      label: "My bet",
      limit: 3,
      window: WINDOW,
      now: BEFORE,
    });
    expect(result._unsafeUnwrapErr().code).toBe("LIMIT_EXCEEDED");
  });

  it("returns INVALID_LABEL for an empty label", async () => {
    const repo = new InMemoryBetRepository();
    const result = await createBet(repo, {
      userId: OWNER,
      label: "",
      limit: 3,
      window: WINDOW,
      now: BEFORE,
    });
    expect(result._unsafeUnwrapErr().code).toBe("INVALID_LABEL");
  });

  it("creates and saves the bet under the limit", async () => {
    const repo = new InMemoryBetRepository();
    const result = await createBet(repo, {
      userId: OWNER,
      label: "New Bet",
      limit: 3,
      window: WINDOW,
      now: BEFORE,
    });
    expect(result.isOk()).toBe(true);
    const bet = result._unsafeUnwrap();
    expect(bet.userId).toBe(OWNER);
    expect(bet.label).toBe("New Bet");
    expect(bet.status).toBe("draft");

    const saved = await repo.findById(bet.id);
    expect(saved).toBeDefined();
    expect(saved?.label).toBe("New Bet");
  });
});
