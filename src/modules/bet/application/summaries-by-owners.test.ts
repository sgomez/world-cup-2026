import { describe, expect, it } from "vitest";
import { Bet, type BetState } from "../domain/bet";
import { InMemoryBetRepository } from "../infrastructure/in-memory-bet-repository";
import { summariesByOwners } from "./summaries-by-owners";

const USER_A = "user-a";
const USER_B = "user-b";
const USER_C = "user-c";

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

describe("summariesByOwners", () => {
  it("returns an empty Map when ownerIds is empty", async () => {
    const repo = new InMemoryBetRepository([bet()]);
    const result = await summariesByOwners(repo, []);
    expect(result.size).toBe(0);
  });

  it("omits an owner that has no bets", async () => {
    const repo = new InMemoryBetRepository([bet({ userId: USER_A })]);
    const result = await summariesByOwners(repo, [USER_A, USER_B]);
    expect(result.has(USER_B)).toBe(false);
  });

  it("groups bets by owner", async () => {
    const repo = new InMemoryBetRepository([
      bet({ id: "a1", userId: USER_A }),
      bet({ id: "b1", userId: USER_B }),
      bet({ id: "b2", userId: USER_B }),
    ]);
    const result = await summariesByOwners(repo, [USER_A, USER_B]);
    expect(result.get(USER_A)).toHaveLength(1);
    expect(result.get(USER_A)?.[0].id).toBe("a1");
    expect(result.get(USER_B)).toHaveLength(2);
  });

  it("maps each bet to a BetSummary", async () => {
    const repo = new InMemoryBetRepository([
      bet({
        id: "a1",
        userId: USER_A,
        label: "Test Label",
        status: "closed",
        createdAt: new Date("2026-02-01T00:00:00Z"),
        updatedAt: new Date("2026-02-02T00:00:00Z"),
      }),
    ]);
    const result = await summariesByOwners(repo, [USER_A]);
    const summary = result.get(USER_A)?.[0];
    expect(summary?.id).toBe("a1");
    expect(summary?.label).toBe("Test Label");
    expect(summary?.status).toBe("closed");
    expect(summary?.createdAt).toEqual(new Date("2026-02-01T00:00:00Z"));
    expect(summary?.updatedAt).toEqual(new Date("2026-02-02T00:00:00Z"));
  });

  it("excludes owners not in the requested ownerIds", async () => {
    const repo = new InMemoryBetRepository([
      bet({ id: "a1", userId: USER_A }),
      bet({ id: "c1", userId: USER_C }),
    ]);
    const result = await summariesByOwners(repo, [USER_A]);
    expect(result.has(USER_C)).toBe(false);
    expect(result.has(USER_A)).toBe(true);
  });

  it("returns empty Map when no owners have bets", async () => {
    const repo = new InMemoryBetRepository();
    const result = await summariesByOwners(repo, [USER_A, USER_B]);
    expect(result.size).toBe(0);
  });
});
