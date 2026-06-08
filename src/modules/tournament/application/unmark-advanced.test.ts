import { describe, expect, it } from "vitest";
import { Tournament } from "../domain/tournament";
import { InMemoryTournamentRepository } from "../infrastructure/in-memory-tournament-repository";
import { unmarkAdvanced } from "./unmark-advanced";

describe("unmarkAdvanced application service", () => {
  it("rejects non-admin actors with FORBIDDEN", async () => {
    const repo = new InMemoryTournamentRepository();
    const result = await unmarkAdvanced(repo, {
      actorRole: "user",
      ref: "1A",
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("FORBIDDEN");
  });

  it("accepts admin actors and unmarks an existing reference", async () => {
    // Seed with a tournament that already has 1A marked as advanced
    const tournament = Tournament.createDefault()
      .markAdvanced("1A")
      ._unsafeUnwrap();
    const repo = new InMemoryTournamentRepository(tournament);

    const result = await unmarkAdvanced(repo, {
      actorRole: "admin",
      ref: "1A",
    });

    expect(result.isOk()).toBe(true);

    const saved = await repo.get();
    expect(saved?.advancement).not.toContain("1A");
  });

  it("rejects invalid advancement references", async () => {
    const repo = new InMemoryTournamentRepository();
    const result = await unmarkAdvanced(repo, {
      actorRole: "admin",
      ref: "INVALID_REF",
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("INVALID_REF");
  });
});
