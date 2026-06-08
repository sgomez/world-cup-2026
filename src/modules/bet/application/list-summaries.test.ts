import { describe, expect, it } from "vitest";
import { Bet, type BetState } from "../domain/bet";
import { InMemoryBetRepository } from "../infrastructure/in-memory-bet-repository";
import { listSummaries } from "./list-summaries";

const OWNER = "user-1";
const OTHER = "user-2";

function bet(overrides: Partial<BetState> = {}): Bet {
  return Bet.fromState({
    id: "bet-1",
    userId: OWNER,
    status: "draft",
    label: "My Bet",
    groupPredictions: null,
    knockoutWinners: {},
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  });
}

describe("listSummaries", () => {
  it("returns an empty list when the owner has no bets", async () => {
    const repo = new InMemoryBetRepository();
    const result = await listSummaries(repo, OWNER);
    expect(result).toEqual([]);
  });

  it("maps the owner's bets to BetSummary values", async () => {
    const repo = new InMemoryBetRepository([bet()]);
    const result = await listSummaries(repo, OWNER);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("bet-1");
    expect(result[0].label).toBe("My Bet");
    expect(result[0].status).toBe("draft");
  });

  it("excludes bets belonging to other owners", async () => {
    const repo = new InMemoryBetRepository([
      bet({ id: "bet-1", userId: OWNER }),
      bet({ id: "bet-2", userId: OTHER }),
    ]);
    const result = await listSummaries(repo, OWNER);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("bet-1");
  });

  it("preserves most-recent-first ordering", async () => {
    const repo = new InMemoryBetRepository([
      bet({ id: "older", createdAt: new Date("2026-01-01T00:00:00Z") }),
      bet({ id: "newer", createdAt: new Date("2026-01-03T00:00:00Z") }),
    ]);
    const result = await listSummaries(repo, OWNER);
    expect(result[0].id).toBe("newer");
    expect(result[1].id).toBe("older");
  });
});
