import { describe, expect, it } from "vitest";
import { InMemoryTournamentRepository } from "../infrastructure/in-memory-tournament-repository";
import { markAdvanced } from "./mark-advanced";

describe("markAdvanced application service", () => {
  it("rejects non-admin actors with FORBIDDEN", async () => {
    const repo = new InMemoryTournamentRepository();
    const result = await markAdvanced(repo, {
      actorRole: "user",
      ref: "1A",
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("FORBIDDEN");
  });

  it("accepts admin actors and lazily creates the singleton tournament", async () => {
    const repo = new InMemoryTournamentRepository();

    // Initially get returns null
    expect(await repo.get()).toBeNull();

    const result = await markAdvanced(repo, {
      actorRole: "admin",
      ref: "1A",
    });

    expect(result.isOk()).toBe(true);

    const saved = await repo.get();
    expect(saved).not.toBeNull();
    expect(saved?.advancement).toContain("1A");
  });

  it("rejects invalid advancement references", async () => {
    const repo = new InMemoryTournamentRepository();
    const result = await markAdvanced(repo, {
      actorRole: "admin",
      ref: "INVALID_REF",
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("INVALID_REF");
  });
});
