import { describe, expect, it } from "vitest";
import { Bet, type BetState } from "../domain/bet";
import { BettingWindow } from "../domain/betting-window";
import { InMemoryBetRepository } from "../infrastructure/in-memory-bet-repository";
import { peerSummariesByOwners } from "./peer-summaries-by-owners";

const USER_A = "user-a";
const USER_B = "user-b";

const DEADLINE = new Date("2026-06-11T19:00:00Z");
const BEFORE = new Date("2026-06-10T00:00:00Z");
const AFTER = new Date("2026-06-12T00:00:00Z");

function bet(overrides: Partial<BetState> = {}): Bet {
  return Bet.fromState({
    id: "bet-1",
    userId: USER_A,
    status: "draft",
    label: "My Bet",
    groupPredictions: null,
    knockoutWinners: {},
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  });
}

describe("peerSummariesByOwners", () => {
  it("returns an empty Map when ownerIds is empty", async () => {
    const window = new BettingWindow(DEADLINE);
    const repo = new InMemoryBetRepository([bet()]);
    const result = await peerSummariesByOwners(repo, [], window, BEFORE);
    expect(result.size).toBe(0);
  });

  it("returns only closed summaries before the deadline", async () => {
    const window = new BettingWindow(DEADLINE);
    const repo = new InMemoryBetRepository([
      bet({ id: "bet-draft", userId: USER_A, status: "draft" }),
      bet({ id: "bet-closed", userId: USER_A, status: "closed" }),
      bet({ id: "bet-b-draft", userId: USER_B, status: "draft" }),
    ]);

    const result = await peerSummariesByOwners(
      repo,
      [USER_A, USER_B],
      window,
      BEFORE,
    );

    // USER_A has one closed bet (visible) and one draft (hidden).
    expect(result.has(USER_A)).toBe(true);
    expect(result.get(USER_A)).toHaveLength(1);
    expect(result.get(USER_A)?.[0].id).toBe("bet-closed");

    // USER_B only has a draft bet, so they should be omitted.
    expect(result.has(USER_B)).toBe(false);
  });

  it("returns all summaries past the deadline", async () => {
    const window = new BettingWindow(DEADLINE);
    const repo = new InMemoryBetRepository([
      bet({ id: "bet-draft", userId: USER_A, status: "draft" }),
      bet({ id: "bet-closed", userId: USER_A, status: "closed" }),
      bet({ id: "bet-b-draft", userId: USER_B, status: "draft" }),
    ]);

    const result = await peerSummariesByOwners(
      repo,
      [USER_A, USER_B],
      window,
      AFTER,
    );

    expect(result.has(USER_A)).toBe(true);
    expect(result.get(USER_A)).toHaveLength(2);

    expect(result.has(USER_B)).toBe(true);
    expect(result.get(USER_B)).toHaveLength(1);
    expect(result.get(USER_B)?.[0].id).toBe("bet-b-draft");
  });
});
