import { describe, expect, it } from "vitest";
import { Tournament } from "../domain/tournament";
import { InMemoryTournamentRepository } from "../infrastructure/in-memory-tournament-repository";
import { setKnockoutResult } from "./set-knockout-result";

describe("setKnockoutResult application service", () => {
  it("rejects non-admin actors with FORBIDDEN", async () => {
    const repo = new InMemoryTournamentRepository();
    const result = await setKnockoutResult(repo, {
      actorRole: "user",
      matchId: "R32-73",
      winnerId: "usa",
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("FORBIDDEN");
  });

  it("accepts admin actors, verifies participants are advanced, and saves the tournament", async () => {
    const repo = new InMemoryTournamentRepository();

    // Setup: default tournament needs teams advanced for R32-73 (2A vs 2B)
    let t = Tournament.createDefault();
    t = t.markAdvanced("2A")._unsafeUnwrap();
    t = t.markAdvanced("2B")._unsafeUnwrap();

    const currentResult = t["getEffectiveResult"]();
    const team2A = currentResult.groupOrders.A[1];

    repo.save(t);

    const result = await setKnockoutResult(repo, {
      actorRole: "admin",
      matchId: "R32-73",
      winnerId: team2A,
    });

    expect(result.isOk()).toBe(true);

    const saved = await repo.get();
    expect(saved).not.toBeNull();
    expect(saved?.result?.knockoutWinners["R32-73"]).toBe(team2A);
  });

  it("fails if participants of R32 are not advanced", async () => {
    const repo = new InMemoryTournamentRepository();

    // Setup: default tournament but teams not advanced for R32-73
    const t = Tournament.createDefault();
    const currentResult = t["getEffectiveResult"]();
    const team2A = currentResult.groupOrders.A[1];

    repo.save(t);

    const result = await setKnockoutResult(repo, {
      actorRole: "super_admin",
      matchId: "R32-73",
      winnerId: team2A,
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("PARTICIPANTS_NOT_ADVANCED");
  });
});
