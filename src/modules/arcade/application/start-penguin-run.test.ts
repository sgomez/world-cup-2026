import { describe, expect, it } from "vitest";
import type { PenguinRun } from "../domain/penguin-run";
import { InMemoryArcadeRunRepository } from "../infrastructure/in-memory-arcade-run-repository";
import { startPenguinRun } from "./start-penguin-run";

describe("startPenguinRun application service", () => {
  const userId = "user-alice";

  function makeRepo(seed: PenguinRun[] = []) {
    return new InMemoryArcadeRunRepository(seed);
  }

  it("creates a run and returns it with server-stamped startedAt", async () => {
    const now = new Date("2026-06-17T10:00:00Z");
    const clock = () => now;
    const repo = makeRepo();

    const result = await startPenguinRun(repo, { userId, clock });

    expect(result.isOk()).toBe(true);
    const { run } = result._unsafeUnwrap();
    expect(run.userId).toBe(userId);
    expect(run.startedAt).toEqual(now);
    expect(run.playDay).toBe("2026-06-17");
    expect(run.status).toBe("in_progress");
    expect(run.bestScore).toBe(0);
  });

  it("persists the run so a subsequent query finds it", async () => {
    const now = new Date("2026-06-17T10:00:00Z");
    const clock = () => now;
    const repo = makeRepo();

    await startPenguinRun(repo, { userId, clock });

    const stored = await repo.findByUserAndPlayDay(userId, "2026-06-17");
    expect(stored).not.toBeNull();
    expect(stored?.userId).toBe(userId);
  });

  it("rejects a second start on the same UTC day", async () => {
    const now = new Date("2026-06-17T10:00:00Z");
    const clock = () => now;
    const repo = makeRepo();

    await startPenguinRun(repo, { userId, clock });
    const second = await startPenguinRun(repo, { userId, clock });

    expect(second.isErr()).toBe(true);
    expect(second._unsafeUnwrapErr().code).toBe("ALREADY_PLAYED_TODAY");
  });

  it("rejects a start later in the same UTC day (different time, same date)", async () => {
    const morning = new Date("2026-06-17T08:00:00Z");
    const evening = new Date("2026-06-17T22:59:59Z");
    const repo = makeRepo();

    await startPenguinRun(repo, { userId, clock: () => morning });
    const second = await startPenguinRun(repo, {
      userId,
      clock: () => evening,
    });

    expect(second.isErr()).toBe(true);
    expect(second._unsafeUnwrapErr().code).toBe("ALREADY_PLAYED_TODAY");
  });

  it("allows a new start after the Play Day boundary (00:00 UTC)", async () => {
    const yesterday = new Date("2026-06-17T23:00:00Z");
    const today = new Date("2026-06-18T00:00:00Z");
    const repo = makeRepo();

    const first = await startPenguinRun(repo, {
      userId,
      clock: () => yesterday,
    });
    expect(first.isOk()).toBe(true);

    const second = await startPenguinRun(repo, { userId, clock: () => today });
    expect(second.isOk()).toBe(true);
    expect(second._unsafeUnwrap().run.playDay).toBe("2026-06-18");
  });

  it("different users can start independently on the same day", async () => {
    const now = new Date("2026-06-17T10:00:00Z");
    const clock = () => now;
    const repo = makeRepo();

    const alice = await startPenguinRun(repo, { userId: "user-alice", clock });
    const bob = await startPenguinRun(repo, { userId: "user-bob", clock });

    expect(alice.isOk()).toBe(true);
    expect(bob.isOk()).toBe(true);
  });

  it("stamps startedAt from the server clock, ignoring any client time", async () => {
    // Arrange: server clock says 10:00 UTC
    const serverTime = new Date("2026-06-17T10:00:00Z");
    const clock = () => serverTime;
    const repo = makeRepo();

    const result = await startPenguinRun(repo, { userId, clock });

    // The returned run's startedAt must match the server clock, not anything else
    expect(result._unsafeUnwrap().run.startedAt).toEqual(serverTime);
  });
});
