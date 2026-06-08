import { describe, expect, it } from "vitest";
import { Tournament } from "../domain/tournament";
import { InMemoryTournamentRepository } from "../infrastructure/in-memory-tournament-repository";
import { setGroupResult } from "./set-group-result";

describe("setGroupResult application service", () => {
  it("rejects non-admin actors with FORBIDDEN", async () => {
    const repo = new InMemoryTournamentRepository();
    const result = await setGroupResult(repo, {
      actorRole: "user",
      group: "A",
      orderedIds: ["team-1", "team-2", "team-3", "team-4"],
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("FORBIDDEN");
  });

  it("accepts admin actors and lazily creates the singleton tournament", async () => {
    const repo = new InMemoryTournamentRepository();

    // Initially get returns null
    expect(await repo.get()).toBeNull();

    const result = await setGroupResult(repo, {
      actorRole: "admin",
      group: "A",
      orderedIds: ["team-1", "team-2", "team-3", "team-4"],
    });

    expect(result.isOk()).toBe(true);

    const saved = await repo.get();
    expect(saved).not.toBeNull();
    expect(saved?.result?.groupOrders.A).toEqual([
      "team-1",
      "team-2",
      "team-3",
      "team-4",
    ]);
  });

  it("accepts super_admin actors and updates an existing tournament", async () => {
    // Seed with an existing tournament
    const initial = Tournament.createDefault();
    const repo = new InMemoryTournamentRepository(initial);

    const result = await setGroupResult(repo, {
      actorRole: "super_admin",
      group: "B",
      orderedIds: ["team-5", "team-6", "team-7", "team-8"],
    });

    expect(result.isOk()).toBe(true);

    const saved = await repo.get();
    expect(saved?.result?.groupOrders.B).toEqual([
      "team-5",
      "team-6",
      "team-7",
      "team-8",
    ]);
  });
});
