import { describe, expect, it } from "vitest";
import { InMemoryTournamentRepository } from "../infrastructure/in-memory-tournament-repository";
import { setThirdPlaceResult } from "./set-third-place-result";

describe("setThirdPlaceResult application service", () => {
  it("rejects non-admin actors with FORBIDDEN", async () => {
    const repo = new InMemoryTournamentRepository();
    const result = await setThirdPlaceResult(repo, {
      actorRole: "user",
      orderedIds: ["3rd-a", "3rd-b"],
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("FORBIDDEN");
  });

  it("accepts admin actors and lazily creates the singleton tournament", async () => {
    const repo = new InMemoryTournamentRepository();

    // Initially get returns null
    expect(await repo.get()).toBeNull();

    const result = await setThirdPlaceResult(repo, {
      actorRole: "admin",
      orderedIds: [
        "3rd-a",
        "3rd-b",
        "3rd-c",
        "3rd-d",
        "3rd-e",
        "3rd-f",
        "3rd-g",
        "3rd-h",
        "3rd-i",
        "3rd-j",
        "3rd-k",
        "3rd-l",
      ],
    });

    expect(result.isOk()).toBe(true);

    const saved = await repo.get();
    expect(saved).not.toBeNull();
    expect(saved?.result?.thirdPlaceOrder[0]).toBe("3rd-a");
  });
});
