import { describe, expect, it } from "vitest";
import { PenguinRun } from "../domain/penguin-run";
import { InMemoryArcadeRunRepository } from "../infrastructure/in-memory-arcade-run-repository";
import { recordHeartbeat } from "./record-heartbeat";

describe("recordHeartbeat application service", () => {
  const userId = "user-alice";

  function makeRun(startedAt: Date): PenguinRun {
    return PenguinRun.create({ userId, startedAt });
  }

  it("updates lastSeenAt and persists the run", async () => {
    const startedAt = new Date("2026-06-17T10:00:00Z");
    const run = makeRun(startedAt);
    const repo = new InMemoryArcadeRunRepository([run]);

    const now = new Date("2026-06-17T10:01:00Z");
    const result = await recordHeartbeat(repo, {
      runId: run.id,
      userId,
      clock: () => now,
    });

    expect(result.isOk()).toBe(true);
    const stored = await repo.findById(run.id);
    expect(stored?.lastSeenAt).toEqual(now);
  });

  it("returns RUN_NOT_FOUND if run does not exist", async () => {
    const repo = new InMemoryArcadeRunRepository([]);

    const result = await recordHeartbeat(repo, {
      runId: "no-such-run",
      userId,
      clock: () => new Date("2026-06-17T10:01:00Z"),
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("RUN_NOT_FOUND");
  });

  it("returns RUN_NOT_IN_PROGRESS if run is already finished", async () => {
    const startedAt = new Date("2026-06-17T10:00:00Z");
    const run = makeRun(startedAt).finish();
    const repo = new InMemoryArcadeRunRepository([run]);

    const result = await recordHeartbeat(repo, {
      runId: run.id,
      userId,
      clock: () => new Date("2026-06-17T10:01:00Z"),
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("RUN_NOT_IN_PROGRESS");
  });

  it("stamps lastSeenAt from the server clock, not any client value", async () => {
    const startedAt = new Date("2026-06-17T10:00:00Z");
    const run = makeRun(startedAt);
    const repo = new InMemoryArcadeRunRepository([run]);

    const serverTime = new Date("2026-06-17T10:02:30Z");
    await recordHeartbeat(repo, {
      runId: run.id,
      userId,
      clock: () => serverTime,
    });

    const stored = await repo.findById(run.id);
    expect(stored?.lastSeenAt).toEqual(serverTime);
  });
});
