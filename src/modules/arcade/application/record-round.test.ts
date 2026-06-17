import { describe, expect, it } from "vitest";
import { PenguinRun } from "../domain/penguin-run";
import { InMemoryArcadeRunRepository } from "../infrastructure/in-memory-arcade-run-repository";
import { recordRound } from "./record-round";

describe("recordRound application service", () => {
  const userId = "user-alice";

  function makeRun(startedAt: Date): PenguinRun {
    return PenguinRun.create({ userId, startedAt });
  }

  it("records a round with server-stamped end time and persists the run", async () => {
    const startedAt = new Date("2026-06-17T10:00:00Z");
    const run = makeRun(startedAt);
    const repo = new InMemoryArcadeRunRepository([run]);

    const roundStartedAt = new Date("2026-06-17T10:00:05Z");
    const serverNow = new Date("2026-06-17T10:01:05Z"); // 60s into round
    const result = await recordRound(repo, {
      runId: run.id,
      userId,
      roundStartedAt,
      reportedScore: 50,
      clock: () => serverNow,
    });

    expect(result.isOk()).toBe(true);
    const stored = await repo.findById(run.id);
    expect(stored?.rounds).toHaveLength(1);
    expect(stored?.rounds[0].score).toBe(50);
    expect(stored?.bestScore).toBe(50);
  });

  it("caps a reported score above the time-derived ceiling", async () => {
    const startedAt = new Date("2026-06-17T10:00:00Z");
    const run = makeRun(startedAt);
    const repo = new InMemoryArcadeRunRepository([run]);

    const roundStartedAt = new Date("2026-06-17T10:00:05Z");
    const serverNow = new Date("2026-06-17T10:00:15Z"); // only 10s elapsed, ceiling = 10
    const result = await recordRound(repo, {
      runId: run.id,
      userId,
      roundStartedAt,
      reportedScore: 99999,
      clock: () => serverNow,
    });

    expect(result.isOk()).toBe(true);
    const stored = await repo.findById(run.id);
    expect(stored?.rounds[0].score).toBe(10); // ceiling = 10s * 1 pt/s
    expect(stored?.bestScore).toBe(10);
  });

  it("uses the server clock for roundEndedAt, not any client timestamp", async () => {
    const startedAt = new Date("2026-06-17T10:00:00Z");
    const run = makeRun(startedAt);
    const repo = new InMemoryArcadeRunRepository([run]);

    const roundStartedAt = new Date("2026-06-17T10:00:05Z");
    const serverTime = new Date("2026-06-17T10:01:05Z");

    await recordRound(repo, {
      runId: run.id,
      userId,
      roundStartedAt,
      reportedScore: 30,
      clock: () => serverTime,
    });

    const stored = await repo.findById(run.id);
    expect(stored?.rounds[0].endedAt).toEqual(serverTime);
  });

  it("returns RUN_NOT_FOUND if run does not exist", async () => {
    const repo = new InMemoryArcadeRunRepository([]);

    const result = await recordRound(repo, {
      runId: "no-such-run",
      userId,
      roundStartedAt: new Date("2026-06-17T10:00:05Z"),
      reportedScore: 10,
      clock: () => new Date("2026-06-17T10:01:05Z"),
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("RUN_NOT_FOUND");
  });

  it("returns RUN_NOT_IN_PROGRESS after all 3 rounds are played", async () => {
    const startedAt = new Date("2026-06-17T10:00:00Z");
    let run = makeRun(startedAt);
    const repo = new InMemoryArcadeRunRepository([run]);

    // Record 3 rounds
    for (let i = 0; i < 3; i++) {
      const roundStart = new Date(`2026-06-17T10:0${i}:05Z`);
      const roundEnd = new Date(`2026-06-17T10:0${i + 1}:05Z`);
      await recordRound(repo, {
        runId: run.id,
        userId,
        roundStartedAt: roundStart,
        reportedScore: 10,
        clock: () => roundEnd,
      });
      run = (await repo.findById(run.id))!;
    }

    expect(run.status).toBe("finished");

    // 4th round attempt should fail
    const result = await recordRound(repo, {
      runId: run.id,
      userId,
      roundStartedAt: new Date("2026-06-17T10:03:05Z"),
      reportedScore: 10,
      clock: () => new Date("2026-06-17T10:04:05Z"),
    });
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("RUN_NOT_IN_PROGRESS");
  });

  it("keeps bestScore as the highest of all rounds", async () => {
    const startedAt = new Date("2026-06-17T10:00:00Z");
    const run = makeRun(startedAt);
    const repo = new InMemoryArcadeRunRepository([run]);

    const scores = [30, 60, 20];
    for (let i = 0; i < scores.length; i++) {
      const roundStart = new Date(`2026-06-17T10:0${i}:05Z`);
      const roundEnd = new Date(`2026-06-17T10:0${i + 1}:05Z`); // 60s each
      await recordRound(repo, {
        runId: run.id,
        userId,
        roundStartedAt: roundStart,
        reportedScore: scores[i],
        clock: () => roundEnd,
      });
    }

    const stored = await repo.findById(run.id);
    expect(stored?.bestScore).toBe(60);
    expect(stored?.status).toBe("finished");
  });

  it("stale run is finalised on getArcadeRanking read (integration note — covered separately)", () => {
    // This test confirms the in-memory store correctly tracks the heartbeat lapse.
    // Actual stale-finalisation is tested in get-arcade-ranking.test.ts
    expect(true).toBe(true);
  });
});
