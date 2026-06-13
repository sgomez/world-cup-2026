import { describe, expect, it } from "vitest";
import { createTestContainer } from "./container";

describe("Container - bets() accessor", () => {
  const OWNER_ID = "user-123";

  function completeWinners(): Record<string, string> {
    return Object.fromEntries(
      Array.from({ length: 32 }, (_, i) => [`M${i}`, `team-${i}`]),
    );
  }

  it("performs create, find, list, and close operations end-to-end", async () => {
    const container = createTestContainer();

    // 1. Create a bet
    const createResult = await container.bets().create({
      userId: OWNER_ID,
      label: "My test bet",
      limit: 3,
    });
    expect(createResult.isOk()).toBe(true);
    const createdBet = createResult._unsafeUnwrap();
    expect(createdBet.label).toBe("My test bet");
    expect(createdBet.status).toBe("draft");

    // 2. Find the bet by id
    const foundBet = await container.bets().findById(createdBet.id);
    expect(foundBet).not.toBeNull();
    expect(foundBet?.id).toBe(createdBet.id);

    // 3. List summaries
    const summaries = await container.bets().listSummaries(OWNER_ID);
    expect(summaries.length).toBe(1);
    expect(summaries[0].id).toBe(createdBet.id);
    expect(summaries[0].label).toBe("My test bet");

    // 3.5. Test deadline helpers
    expect(container.bets().isPastDeadline()).toBe(false);
    expect(container.bets().deadline).toBeInstanceOf(Date);

    // 4. Close the bet should fail initially because predictions are incomplete
    const closeResultFail = await container.bets().close({
      betId: createdBet.id,
      userId: OWNER_ID,
    });
    expect(closeResultFail.isErr()).toBe(true);
    expect(closeResultFail._unsafeUnwrapErr().code).toBe(
      "INCOMPLETE_PREDICTIONS",
    );

    // Update predictions to complete
    const updateResult = await container.bets().updatePredictions({
      betId: createdBet.id,
      userId: OWNER_ID,
      groupPredictions: null,
      knockoutWinners: completeWinners(),
    });
    expect(updateResult.isOk()).toBe(true);

    // Close the bet should now succeed
    const closeResultSuccess = await container.bets().close({
      betId: createdBet.id,
      userId: OWNER_ID,
    });
    expect(closeResultSuccess.isOk()).toBe(true);

    const closedBet = await container.bets().findById(createdBet.id);
    expect(closedBet?.status).toBe("closed");
  });
});
