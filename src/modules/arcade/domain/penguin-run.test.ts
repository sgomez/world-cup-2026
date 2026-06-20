import { describe, expect, it } from "vitest";
import { getWeekRange, PenguinRun, toPlayDay } from "./penguin-run";

describe("getWeekRange", () => {
  it("returns Monday 00:00:00.000 UTC as start and Sunday 23:59:59.999 UTC as end for a mid-week date", () => {
    // 2026-06-17 is a Wednesday
    const date = new Date("2026-06-17T14:30:00Z");
    const { start, end } = getWeekRange(date);
    expect(start.toISOString()).toBe("2026-06-15T00:00:00.000Z"); // Monday
    expect(end.toISOString()).toBe("2026-06-21T23:59:59.999Z"); // Sunday
  });

  it("returns the correct range when the date is Monday 00:00:00 UTC", () => {
    const date = new Date("2026-06-15T00:00:00.000Z"); // Monday
    const { start, end } = getWeekRange(date);
    expect(start.toISOString()).toBe("2026-06-15T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-06-21T23:59:59.999Z");
  });

  it("returns the correct range when the date is Sunday 23:59:59.999 UTC", () => {
    const date = new Date("2026-06-21T23:59:59.999Z"); // Sunday
    const { start, end } = getWeekRange(date);
    expect(start.toISOString()).toBe("2026-06-15T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-06-21T23:59:59.999Z");
  });

  it("returns the correct range for a Sunday (same week as the preceding Monday)", () => {
    const date = new Date("2026-06-21T10:00:00Z"); // Sunday
    const { start, end } = getWeekRange(date);
    expect(start.toISOString()).toBe("2026-06-15T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-06-21T23:59:59.999Z");
  });

  it("rolls to next week correctly on Monday", () => {
    const date = new Date("2026-06-22T00:00:00Z"); // Next Monday
    const { start, end } = getWeekRange(date);
    expect(start.toISOString()).toBe("2026-06-22T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-06-28T23:59:59.999Z");
  });
});

describe("PenguinRun aggregate", () => {
  const userId = "user-alice";

  describe("toPlayDay", () => {
    it("returns the UTC calendar date string for a timestamp", () => {
      const t = new Date("2026-06-17T23:59:59Z");
      expect(toPlayDay(t)).toBe("2026-06-17");
    });

    it("rolls over at 00:00 UTC", () => {
      const before = new Date("2026-06-17T23:59:59Z");
      const after = new Date("2026-06-18T00:00:00Z");
      expect(toPlayDay(before)).toBe("2026-06-17");
      expect(toPlayDay(after)).toBe("2026-06-18");
    });
  });

  describe("PenguinRun.create", () => {
    it("creates a run with correct userId, playDay and startedAt", () => {
      const startedAt = new Date("2026-06-17T10:00:00Z");
      const run = PenguinRun.create({ userId, startedAt });

      expect(run.userId).toBe(userId);
      expect(run.playDay).toBe("2026-06-17");
      expect(run.startedAt).toEqual(startedAt);
      expect(run.status).toBe("in_progress");
      expect(run.bestScore).toBe(0);
    });

    it("assigns a unique id", () => {
      const startedAt = new Date("2026-06-17T10:00:00Z");
      const run1 = PenguinRun.create({ userId, startedAt });
      const run2 = PenguinRun.create({ userId, startedAt });
      expect(run1.id).not.toBe(run2.id);
    });
  });

  describe("PenguinRun.fromState", () => {
    it("reconstructs a run from persisted state", () => {
      const state = {
        id: "run-1",
        userId,
        playDay: "2026-06-17",
        startedAt: new Date("2026-06-17T10:00:00Z"),
        lastSeenAt: new Date("2026-06-17T10:01:00Z"),
        status: "in_progress" as const,
        bestScore: 42,
        rounds: [] as {
          roundNumber: number;
          startedAt: Date;
          endedAt: Date;
          score: number;
        }[],
      };
      const run = PenguinRun.fromState(state);

      expect(run.id).toBe("run-1");
      expect(run.userId).toBe(userId);
      expect(run.playDay).toBe("2026-06-17");
      expect(run.bestScore).toBe(42);
      expect(run.status).toBe("in_progress");
    });
  });

  describe("isOwnedBy", () => {
    it("returns true for the owner", () => {
      const run = PenguinRun.create({
        userId,
        startedAt: new Date("2026-06-17T10:00:00Z"),
      });
      expect(run.isOwnedBy(userId)).toBe(true);
    });

    it("returns false for another user", () => {
      const run = PenguinRun.create({
        userId,
        startedAt: new Date("2026-06-17T10:00:00Z"),
      });
      expect(run.isOwnedBy("user-bob")).toBe(false);
    });
  });

  describe("recordHeartbeat", () => {
    it("updates lastSeenAt to the provided timestamp", () => {
      const startedAt = new Date("2026-06-17T10:00:00Z");
      const run = PenguinRun.create({ userId, startedAt });

      const pingTime = new Date("2026-06-17T10:01:00Z");
      const updated = run.recordHeartbeat(pingTime);

      expect("code" in updated).toBe(false);
      expect((updated as PenguinRun).lastSeenAt).toEqual(pingTime);
    });

    it("does not alter status or bestScore", () => {
      const startedAt = new Date("2026-06-17T10:00:00Z");
      const run = PenguinRun.create({ userId, startedAt });

      const updated = run.recordHeartbeat(new Date("2026-06-17T10:01:00Z"));

      expect("code" in updated).toBe(false);
      const updatedRun = updated as PenguinRun;
      expect(updatedRun.status).toBe("in_progress");
      expect(updatedRun.bestScore).toBe(0);
    });

    it("returns an error if run is not in_progress", () => {
      const startedAt = new Date("2026-06-17T10:00:00Z");
      let run = PenguinRun.create({ userId, startedAt });
      // finalize the run first
      run = run.finalise(new Date("2026-06-17T10:05:00Z"));

      const result = run.recordHeartbeat(new Date("2026-06-17T10:06:00Z"));
      expect(result).toHaveProperty("code");
      expect((result as { code: string }).code).toBe("RUN_NOT_IN_PROGRESS");
    });
  });

  describe("recordRound", () => {
    const startedAt = new Date("2026-06-17T10:00:00Z");

    it("records a first round and updates bestScore", () => {
      const run = PenguinRun.create({ userId, startedAt });
      const roundStart = new Date("2026-06-17T10:00:05Z");
      const roundEnd = new Date("2026-06-17T10:01:05Z"); // 60s elapsed
      // At 60s elapsed, ceiling is 60 * POINTS_PER_SECOND (e.g. 1), so score of 50 fits
      const result = run.recordRound({
        roundStartedAt: roundStart,
        roundEndedAt: roundEnd,
        reportedScore: 50,
      });

      expect("code" in result).toBe(false);
      const updated = result as PenguinRun;
      expect(updated.rounds).toHaveLength(1);
      expect(updated.rounds[0].score).toBe(50);
      expect(updated.bestScore).toBe(50);
      expect(updated.status).toBe("in_progress");
    });

    it("resets bestScore to max when second round is better", () => {
      let run = PenguinRun.create({ userId, startedAt });

      const r1Start = new Date("2026-06-17T10:00:05Z");
      const r1End = new Date("2026-06-17T10:01:05Z"); // 60s
      run = run.recordRound({
        roundStartedAt: r1Start,
        roundEndedAt: r1End,
        reportedScore: 30,
      }) as PenguinRun;

      const r2Start = new Date("2026-06-17T10:01:10Z");
      const r2End = new Date("2026-06-17T10:02:10Z"); // another 60s
      run = run.recordRound({
        roundStartedAt: r2Start,
        roundEndedAt: r2End,
        reportedScore: 55,
      }) as PenguinRun;

      expect(run.bestScore).toBe(55);
      expect(run.rounds).toHaveLength(2);
    });

    it("keeps bestScore when third round is worse", () => {
      let run = PenguinRun.create({ userId, startedAt });

      const r1Start = new Date("2026-06-17T10:00:05Z");
      const r1End = new Date("2026-06-17T10:01:05Z");
      run = run.recordRound({
        roundStartedAt: r1Start,
        roundEndedAt: r1End,
        reportedScore: 60,
      }) as PenguinRun;

      const r2Start = new Date("2026-06-17T10:01:10Z");
      const r2End = new Date("2026-06-17T10:02:10Z");
      run = run.recordRound({
        roundStartedAt: r2Start,
        roundEndedAt: r2End,
        reportedScore: 20,
      }) as PenguinRun;

      const r3Start = new Date("2026-06-17T10:02:15Z");
      const r3End = new Date("2026-06-17T10:03:15Z");
      run = run.recordRound({
        roundStartedAt: r3Start,
        roundEndedAt: r3End,
        reportedScore: 10,
      }) as PenguinRun;

      expect(run.bestScore).toBe(60);
      expect(run.rounds).toHaveLength(3);
      expect(run.status).toBe("finished");
    });

    it("caps a reported score that exceeds the time-derived ceiling", () => {
      const run = PenguinRun.create({ userId, startedAt });
      const roundStart = new Date("2026-06-17T10:00:05Z");
      const roundEnd = new Date("2026-06-17T10:00:15Z"); // 10s elapsed
      // ceiling = 10 * POINTS_PER_SECOND; report a wildly inflated score
      const result = run.recordRound({
        roundStartedAt: roundStart,
        roundEndedAt: roundEnd,
        reportedScore: 999999,
      });

      expect("code" in result).toBe(false);
      const updated = result as PenguinRun;
      // score must be capped, not the raw reported value
      expect(updated.rounds[0].score).toBeLessThan(999999);
      expect(updated.bestScore).toBeLessThan(999999);
    });

    it("score resets to zero at the start of each new round (independent rounds)", () => {
      let run = PenguinRun.create({ userId, startedAt });

      const r1Start = new Date("2026-06-17T10:00:05Z");
      const r1End = new Date("2026-06-17T10:01:05Z");
      run = run.recordRound({
        roundStartedAt: r1Start,
        roundEndedAt: r1End,
        reportedScore: 50,
      }) as PenguinRun;

      const r2Start = new Date("2026-06-17T10:01:10Z");
      const r2End = new Date("2026-06-17T10:01:20Z"); // only 10s
      // Score of 5 is within the 10s ceiling — it should be recorded as 5, not accumulated
      run = run.recordRound({
        roundStartedAt: r2Start,
        roundEndedAt: r2End,
        reportedScore: 5,
      }) as PenguinRun;

      // bestScore stays 50 (from round 1), round 2 is separate with score 5
      expect(run.rounds[1].score).toBe(5);
      expect(run.bestScore).toBe(50);
    });

    it("returns an error if run is not in_progress", () => {
      const run = PenguinRun.create({ userId, startedAt });
      const r1Start = new Date("2026-06-17T10:00:05Z");
      const r1End = new Date("2026-06-17T10:01:05Z");
      const r2Start = new Date("2026-06-17T10:01:10Z");
      const r2End = new Date("2026-06-17T10:02:10Z");
      const r3Start = new Date("2026-06-17T10:02:15Z");
      const r3End = new Date("2026-06-17T10:03:15Z");

      let updated = run.recordRound({
        roundStartedAt: r1Start,
        roundEndedAt: r1End,
        reportedScore: 10,
      }) as PenguinRun;
      updated = updated.recordRound({
        roundStartedAt: r2Start,
        roundEndedAt: r2End,
        reportedScore: 10,
      }) as PenguinRun;
      updated = updated.recordRound({
        roundStartedAt: r3Start,
        roundEndedAt: r3End,
        reportedScore: 10,
      }) as PenguinRun;

      expect(updated.status).toBe("finished");

      const extraRoundResult = updated.recordRound({
        roundStartedAt: new Date("2026-06-17T10:03:20Z"),
        roundEndedAt: new Date("2026-06-17T10:04:20Z"),
        reportedScore: 10,
      });
      expect("code" in extraRoundResult).toBe(true);
      expect((extraRoundResult as { code: string }).code).toBe(
        "RUN_NOT_IN_PROGRESS",
      );
    });
  });

  describe("finish", () => {
    it("transitions status to finished", () => {
      const startedAt = new Date("2026-06-17T10:00:00Z");
      let run = PenguinRun.create({ userId, startedAt });

      // Record all 3 rounds; 3rd call transitions to finished automatically
      const r1Start = new Date("2026-06-17T10:00:05Z");
      const r1End = new Date("2026-06-17T10:01:05Z");
      const r2Start = new Date("2026-06-17T10:01:10Z");
      const r2End = new Date("2026-06-17T10:02:10Z");
      const r3Start = new Date("2026-06-17T10:02:15Z");
      const r3End = new Date("2026-06-17T10:03:15Z");

      run = run.recordRound({
        roundStartedAt: r1Start,
        roundEndedAt: r1End,
        reportedScore: 40,
      }) as PenguinRun;
      run = run.recordRound({
        roundStartedAt: r2Start,
        roundEndedAt: r2End,
        reportedScore: 50,
      }) as PenguinRun;
      run = run.recordRound({
        roundStartedAt: r3Start,
        roundEndedAt: r3End,
        reportedScore: 30,
      }) as PenguinRun;

      expect(run.status).toBe("finished");
      expect(run.bestScore).toBe(50);
    });

    it("finish() can manually transition an in_progress run to finished", () => {
      const startedAt = new Date("2026-06-17T10:00:00Z");
      const run = PenguinRun.create({ userId, startedAt });
      const finished = run.finish();
      expect(finished.status).toBe("finished");
    });
  });

  describe("finalise (stale/disconnect)", () => {
    it("transitions status to finalised with a server timestamp", () => {
      const startedAt = new Date("2026-06-17T10:00:00Z");
      const run = PenguinRun.create({ userId, startedAt });

      const finalisedAt = new Date("2026-06-17T10:10:00Z");
      const finalised = run.finalise(finalisedAt);

      expect(finalised.status).toBe("finalised");
      expect(finalised.lastSeenAt).toEqual(finalisedAt);
    });

    it("preserves the bestScore accumulated so far on finalisation", () => {
      const startedAt = new Date("2026-06-17T10:00:00Z");
      let run = PenguinRun.create({ userId, startedAt });

      const r1Start = new Date("2026-06-17T10:00:05Z");
      const r1End = new Date("2026-06-17T10:01:05Z");
      run = run.recordRound({
        roundStartedAt: r1Start,
        roundEndedAt: r1End,
        reportedScore: 42,
      }) as PenguinRun;

      const finalisedAt = new Date("2026-06-17T10:10:00Z");
      const finalised = run.finalise(finalisedAt);

      expect(finalised.bestScore).toBe(42);
      expect(finalised.status).toBe("finalised");
    });

    it("isStale returns true when lastSeenAt is older than tolerance", () => {
      const startedAt = new Date("2026-06-17T10:00:00Z");
      const run = PenguinRun.create({ userId, startedAt });

      const now = new Date("2026-06-17T10:05:00Z"); // 5 min later
      const toleranceMs = 2 * 60 * 1000; // 2 min

      expect(run.isStale(now, toleranceMs)).toBe(true);
    });

    it("isStale returns false when lastSeenAt is within tolerance", () => {
      const startedAt = new Date("2026-06-17T10:00:00Z");
      const run = PenguinRun.create({ userId, startedAt });

      const now = new Date("2026-06-17T10:01:00Z"); // 1 min later
      const toleranceMs = 2 * 60 * 1000; // 2 min

      expect(run.isStale(now, toleranceMs)).toBe(false);
    });
  });
});
