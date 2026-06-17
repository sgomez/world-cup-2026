import { describe, expect, it } from "vitest";
import { PenguinRun } from "../domain/penguin-run";
import { InMemoryArcadeRunRepository } from "../infrastructure/in-memory-arcade-run-repository";
import { finishPenguinRun } from "./finish-penguin-run";
import { recordRound } from "./record-round";

describe("finishPenguinRun application service", () => {
  const userId = "user-alice";

  function makeRun(startedAt: Date): PenguinRun {
    return PenguinRun.create({ userId, startedAt });
  }

  it("transitions an in_progress run to finished and persists it", async () => {
    const startedAt = new Date("2026-06-17T10:00:00Z");
    const run = makeRun(startedAt);
    const repo = new InMemoryArcadeRunRepository([run]);

    const result = await finishPenguinRun(repo, {
      runId: run.id,
      userId,
    });

    expect(result.isOk()).toBe(true);
    const stored = await repo.findById(run.id);
    expect(stored?.status).toBe("finished");
  });

  it("persists the bestScore accumulated so far", async () => {
    const startedAt = new Date("2026-06-17T10:00:00Z");
    const run = makeRun(startedAt);
    const repo = new InMemoryArcadeRunRepository([run]);

    // Record one round scoring 42
    await recordRound(repo, {
      runId: run.id,
      userId,
      roundStartedAt: new Date("2026-06-17T10:00:05Z"),
      reportedScore: 42,
      clock: () => new Date("2026-06-17T10:01:05Z"),
    });

    const result = await finishPenguinRun(repo, { runId: run.id, userId });

    expect(result.isOk()).toBe(true);
    const stored = await repo.findById(run.id);
    expect(stored?.bestScore).toBe(42);
    expect(stored?.status).toBe("finished");
  });

  it("returns RUN_NOT_FOUND if run does not exist", async () => {
    const repo = new InMemoryArcadeRunRepository([]);

    const result = await finishPenguinRun(repo, {
      runId: "no-such-run",
      userId,
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("RUN_NOT_FOUND");
  });

  it("returns RUN_NOT_FOUND if the userId does not own the run", async () => {
    const startedAt = new Date("2026-06-17T10:00:00Z");
    const run = makeRun(startedAt);
    const repo = new InMemoryArcadeRunRepository([run]);

    const result = await finishPenguinRun(repo, {
      runId: run.id,
      userId: "user-bob", // wrong owner
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("RUN_NOT_FOUND");
  });

  it("returns RUN_NOT_IN_PROGRESS if already finished", async () => {
    const startedAt = new Date("2026-06-17T10:00:00Z");
    const run = makeRun(startedAt).finish();
    const repo = new InMemoryArcadeRunRepository([run]);

    const result = await finishPenguinRun(repo, { runId: run.id, userId });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("RUN_NOT_IN_PROGRESS");
  });
});
