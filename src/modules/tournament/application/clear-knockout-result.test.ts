import { describe, expect, it } from "vitest";
import { Tournament } from "../domain/tournament";
import { InMemoryTournamentRepository } from "../infrastructure/in-memory-tournament-repository";
import { clearKnockoutResult } from "./clear-knockout-result";

describe("clearKnockoutResult application service", () => {
  it("rejects non-admin actors with FORBIDDEN", async () => {
    const repo = new InMemoryTournamentRepository();
    const result = await clearKnockoutResult(repo, {
      actorRole: "user",
      matchId: "R32-73",
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("FORBIDDEN");
  });

  it("accepts admin actors and clears the winner cascades", async () => {
    const repo = new InMemoryTournamentRepository();

    // Setup: default tournament with advanced teams and recorded winner
    let t = Tournament.createDefault();
    t = t.markAdvanced("2A")._unsafeUnwrap();
    t = t.markAdvanced("2B")._unsafeUnwrap();

    const currentResult = t["getEffectiveResult"]();
    const team2A = currentResult.groupOrders.A[1];

    t = t.setKnockoutWinner("R32-73", team2A)._unsafeUnwrap();
    expect(t.result?.knockoutWinners["R32-73"]).toBe(team2A);

    repo.save(t);

    const result = await clearKnockoutResult(repo, {
      actorRole: "admin",
      matchId: "R32-73",
    });

    expect(result.isOk()).toBe(true);

    const saved = await repo.get();
    expect(saved).not.toBeNull();
    expect(saved?.result?.knockoutWinners["R32-73"]).toBeUndefined();
  });
});
