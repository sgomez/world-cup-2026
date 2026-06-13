import { okAsync } from "neverthrow";
import { describe, expect, it } from "vitest";
import { Bet } from "../domain/bet";
import { InMemoryBetRepository } from "../infrastructure/in-memory-bet-repository";
import { mutateOwnedBet } from "./mutate-owned-bet";

describe("mutateOwnedBet pipeline guard ordering", () => {
  const OWNER = "user-1";

  function createTestBet(): Bet {
    return Bet.fromState({
      id: "bet-1",
      userId: OWNER,
      status: "draft",
      label: "My bet",
      groupPredictions: null,
      knockoutWinners: {},
    });
  }

  it("pins the guard ordering: NOT_FOUND for missing bet, FORBIDDEN for wrong owner", async () => {
    const repo = new InMemoryBetRepository([createTestBet()]);

    const testUseCase = (betId: string, userId: string) =>
      mutateOwnedBet(repo, { betId, userId }, (bet) => okAsync(bet));

    // 1. Missing bet requested by anyone -> NOT_FOUND (existence check runs first)
    const missingResult = await testUseCase("missing-bet", "someone-else");
    expect(missingResult.isErr()).toBe(true);
    expect(missingResult._unsafeUnwrapErr().code).toBe("NOT_FOUND");

    // 2. Existing bet requested by wrong owner -> FORBIDDEN (ownership check runs second)
    const forbiddenResult = await testUseCase("bet-1", "someone-else");
    expect(forbiddenResult.isErr()).toBe(true);
    expect(forbiddenResult._unsafeUnwrapErr().code).toBe("FORBIDDEN");

    // 3. Existing bet requested by owner -> succeeds
    const successResult = await testUseCase("bet-1", OWNER);
    expect(successResult.isOk()).toBe(true);
  });
});
