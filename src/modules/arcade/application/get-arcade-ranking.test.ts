import { describe, expect, it } from "vitest";
import { PenguinRun } from "../domain/penguin-run";
import { InMemoryArcadeRunRepository } from "../infrastructure/in-memory-arcade-run-repository";
import { getArcadeRanking } from "./get-arcade-ranking";

/** Minimal NameResolver that resolves from a static map. */
function makeNameResolver(
  map: Record<string, string>,
): (userId: string) => Promise<string | null> {
  return async (userId: string) => map[userId] ?? null;
}

describe("getArcadeRanking application service", () => {
  const STALE_TOLERANCE_MS = 2 * 60 * 1000; // 2 minutes

  function makeFinishedRun(args: {
    userId: string;
    startedAt: Date;
    scores: number[];
  }): PenguinRun {
    let run = PenguinRun.create({
      userId: args.userId,
      startedAt: args.startedAt,
    });
    for (const score of args.scores) {
      const roundStart = args.startedAt;
      const roundEnd = new Date(args.startedAt.getTime() + score * 1000 + 5000);
      const result = run.recordRound({
        roundStartedAt: roundStart,
        roundEndedAt: roundEnd,
        reportedScore: score,
      });
      if ("code" in result)
        throw new Error(`recordRound failed: ${result.code}`);
      run = result;
    }
    return run.finish();
  }

  it("returns empty ranking when no runs exist", async () => {
    const repo = new InMemoryArcadeRunRepository([]);
    const clock = () => new Date("2026-06-17T12:00:00Z");

    const result = await getArcadeRanking(repo, {
      clock,
      staleTolerance: STALE_TOLERANCE_MS,
    });

    expect(result).toEqual([]);
  });

  it("returns one row per user with their all-time best score, ordered descending", async () => {
    const aliceRun = makeFinishedRun({
      userId: "user-alice",
      startedAt: new Date("2026-06-17T10:00:00Z"),
      scores: [30, 10, 5],
    });
    const bobRun = makeFinishedRun({
      userId: "user-bob",
      startedAt: new Date("2026-06-17T10:05:00Z"),
      scores: [50, 20, 8],
    });

    const repo = new InMemoryArcadeRunRepository([aliceRun, bobRun]);
    const clock = () => new Date("2026-06-17T12:00:00Z");

    const result = await getArcadeRanking(repo, {
      clock,
      staleTolerance: STALE_TOLERANCE_MS,
    });

    expect(result).toHaveLength(2);
    expect(result[0].userId).toBe("user-bob");
    expect(result[0].rank).toBe(1);
    expect(result[0].bestScore).toBe(50);
    expect(result[1].userId).toBe("user-alice");
    expect(result[1].rank).toBe(2);
    expect(result[1].bestScore).toBe(30);
  });

  it("uses the user's all-time best across multiple runs on different days", async () => {
    const aliceRun1 = makeFinishedRun({
      userId: "user-alice",
      startedAt: new Date("2026-06-15T10:00:00Z"),
      scores: [40],
    });
    const aliceRun2 = makeFinishedRun({
      userId: "user-alice",
      startedAt: new Date("2026-06-17T10:00:00Z"),
      scores: [25],
    });

    const repo = new InMemoryArcadeRunRepository([aliceRun1, aliceRun2]);
    const clock = () => new Date("2026-06-17T12:00:00Z");

    const result = await getArcadeRanking(repo, {
      clock,
      staleTolerance: STALE_TOLERANCE_MS,
    });

    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe("user-alice");
    expect(result[0].bestScore).toBe(40);
  });

  it("breaks ties by earliest achievedAt (run startedAt)", async () => {
    // Both users achieve bestScore = 30, but alice did it first
    const aliceRun = makeFinishedRun({
      userId: "user-alice",
      startedAt: new Date("2026-06-15T09:00:00Z"),
      scores: [30],
    });
    const bobRun = makeFinishedRun({
      userId: "user-bob",
      startedAt: new Date("2026-06-16T10:00:00Z"),
      scores: [30],
    });

    const repo = new InMemoryArcadeRunRepository([aliceRun, bobRun]);
    const clock = () => new Date("2026-06-17T12:00:00Z");

    const result = await getArcadeRanking(repo, {
      clock,
      staleTolerance: STALE_TOLERANCE_MS,
    });

    expect(result).toHaveLength(2);
    expect(result[0].userId).toBe("user-alice"); // earlier achievedAt wins
    expect(result[0].rank).toBe(1);
    expect(result[1].userId).toBe("user-bob");
    expect(result[1].rank).toBe(2);
  });

  it("finalises stale in_progress runs before computing the ranking", async () => {
    // Carol started a run and scored in round 1, but never finished
    let carolRun = PenguinRun.create({
      userId: "user-carol",
      startedAt: new Date("2026-06-17T10:00:00Z"),
    });
    const roundEnd = new Date("2026-06-17T10:00:30Z");
    const result = carolRun.recordRound({
      roundStartedAt: new Date("2026-06-17T10:00:00Z"),
      roundEndedAt: roundEnd,
      reportedScore: 20,
    });
    if ("code" in result) throw new Error("recordRound failed");
    carolRun = result; // still in_progress, bestScore = 20

    // lastSeenAt was set at startedAt which is > 2 min ago
    const repo = new InMemoryArcadeRunRepository([carolRun]);
    const now = new Date("2026-06-17T10:05:00Z"); // 5 minutes later — stale
    const clock = () => now;

    const ranking = await getArcadeRanking(repo, {
      clock,
      staleTolerance: STALE_TOLERANCE_MS,
    });

    // Carol's run should be finalised and appear in ranking with bestScore = 20
    expect(ranking).toHaveLength(1);
    expect(ranking[0].userId).toBe("user-carol");
    expect(ranking[0].bestScore).toBe(20);

    // The run in the repo should now be finalised
    const stored = await repo.findById(carolRun.id);
    expect(stored?.status).toBe("finalised");
  });

  it("does not finalise non-stale in_progress runs", async () => {
    let activeRun = PenguinRun.create({
      userId: "user-dave",
      startedAt: new Date("2026-06-17T10:00:00Z"),
    });
    const result = activeRun.recordRound({
      roundStartedAt: new Date("2026-06-17T10:00:00Z"),
      roundEndedAt: new Date("2026-06-17T10:00:20Z"),
      reportedScore: 15,
    });
    if ("code" in result) throw new Error("recordRound failed");
    activeRun = result;

    // lastSeenAt = startedAt. Now = 1 min later, within tolerance
    const repo = new InMemoryArcadeRunRepository([activeRun]);
    const now = new Date("2026-06-17T10:01:00Z"); // 1 minute — not stale
    const clock = () => now;

    const ranking = await getArcadeRanking(repo, {
      clock,
      staleTolerance: STALE_TOLERANCE_MS,
    });

    // Active run is not stale — not finalised, not in ranking (in_progress excluded)
    expect(ranking).toHaveLength(0);

    const stored = await repo.findById(activeRun.id);
    expect(stored?.status).toBe("in_progress");
  });

  it("excludes runs with bestScore of 0 from the ranking", async () => {
    // A run that was started but no rounds were recorded
    const emptyRun = PenguinRun.create({
      userId: "user-empty",
      startedAt: new Date("2026-06-17T10:00:00Z"),
    }).finish();

    const repo = new InMemoryArcadeRunRepository([emptyRun]);
    const clock = () => new Date("2026-06-17T12:00:00Z");

    const result = await getArcadeRanking(repo, {
      clock,
      staleTolerance: STALE_TOLERANCE_MS,
    });

    expect(result).toHaveLength(0);
  });

  it("resolves userName via the provided NameResolver", async () => {
    const aliceRun = makeFinishedRun({
      userId: "user-alice",
      startedAt: new Date("2026-06-17T10:00:00Z"),
      scores: [30],
    });

    const repo = new InMemoryArcadeRunRepository([aliceRun]);
    const clock = () => new Date("2026-06-17T12:00:00Z");
    const nameResolver = makeNameResolver({ "user-alice": "Alice" });

    const result = await getArcadeRanking(repo, {
      clock,
      staleTolerance: STALE_TOLERANCE_MS,
      nameResolver,
    });

    expect(result).toHaveLength(1);
    expect(result[0].userName).toBe("Alice");
  });

  it("falls back to userId when NameResolver returns null", async () => {
    const bobRun = makeFinishedRun({
      userId: "user-bob",
      startedAt: new Date("2026-06-17T10:00:00Z"),
      scores: [20],
    });

    const repo = new InMemoryArcadeRunRepository([bobRun]);
    const clock = () => new Date("2026-06-17T12:00:00Z");
    const nameResolver = makeNameResolver({}); // returns null for user-bob

    const result = await getArcadeRanking(repo, {
      clock,
      staleTolerance: STALE_TOLERANCE_MS,
      nameResolver,
    });

    expect(result).toHaveLength(1);
    expect(result[0].userName).toBe("user-bob");
  });

  it("returns userId as userName when no NameResolver is provided", async () => {
    const carolRun = makeFinishedRun({
      userId: "user-carol",
      startedAt: new Date("2026-06-17T10:00:00Z"),
      scores: [10],
    });

    const repo = new InMemoryArcadeRunRepository([carolRun]);
    const clock = () => new Date("2026-06-17T12:00:00Z");

    const result = await getArcadeRanking(repo, {
      clock,
      staleTolerance: STALE_TOLERANCE_MS,
      // no nameResolver
    });

    expect(result).toHaveLength(1);
    expect(result[0].userName).toBe("user-carol");
  });

  describe("period filtering", () => {
    function makeFinishedRunOnDay(
      userId: string,
      dateStr: string,
      score: number,
    ): ReturnType<typeof makeFinishedRun> {
      return makeFinishedRun({
        userId,
        startedAt: new Date(`${dateStr}T10:00:00Z`),
        scores: [score],
      });
    }

    it("daily period returns only runs from today's Play Day", async () => {
      const todayRun = makeFinishedRunOnDay("user-alice", "2026-06-17", 50);
      const yesterdayRun = makeFinishedRunOnDay("user-bob", "2026-06-16", 80);

      const repo = new InMemoryArcadeRunRepository([todayRun, yesterdayRun]);
      // Clock is 2026-06-17: today
      const clock = () => new Date("2026-06-17T12:00:00Z");

      const result = await getArcadeRanking(repo, {
        clock,
        staleTolerance: STALE_TOLERANCE_MS,
        period: "daily",
      });

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe("user-alice");
      expect(result[0].bestScore).toBe(50);
    });

    it("weekly period returns only runs from the current UTC week (Mon–Sun)", async () => {
      // 2026-06-17 is a Wednesday; week is Mon 2026-06-15 to Sun 2026-06-21
      const thisWeekRun = makeFinishedRunOnDay("user-alice", "2026-06-15", 40); // Monday
      const lastWeekRun = makeFinishedRunOnDay("user-bob", "2026-06-14", 90); // Sunday last week

      const repo = new InMemoryArcadeRunRepository([thisWeekRun, lastWeekRun]);
      const clock = () => new Date("2026-06-17T12:00:00Z"); // Wednesday

      const result = await getArcadeRanking(repo, {
        clock,
        staleTolerance: STALE_TOLERANCE_MS,
        period: "weekly",
      });

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe("user-alice");
      expect(result[0].bestScore).toBe(40);
    });

    it("all_time period returns runs from all days", async () => {
      const oldRun = makeFinishedRunOnDay("user-alice", "2026-01-01", 100);
      const newRun = makeFinishedRunOnDay("user-bob", "2026-06-17", 50);

      const repo = new InMemoryArcadeRunRepository([oldRun, newRun]);
      const clock = () => new Date("2026-06-17T12:00:00Z");

      const result = await getArcadeRanking(repo, {
        clock,
        staleTolerance: STALE_TOLERANCE_MS,
        period: "all_time",
      });

      expect(result).toHaveLength(2);
      expect(result[0].userId).toBe("user-alice");
      expect(result[0].bestScore).toBe(100);
    });

    it("defaults to all_time when no period is specified", async () => {
      const oldRun = makeFinishedRunOnDay("user-alice", "2026-01-01", 100);
      const repo = new InMemoryArcadeRunRepository([oldRun]);
      const clock = () => new Date("2026-06-17T12:00:00Z");

      const result = await getArcadeRanking(repo, {
        clock,
        staleTolerance: STALE_TOLERANCE_MS,
        // no period
      });

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe("user-alice");
    });
  });
});
