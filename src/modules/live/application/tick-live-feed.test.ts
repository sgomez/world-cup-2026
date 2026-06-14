import { err, ok } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Match } from "@/modules/schedule";
import type { Clock } from "../domain/clock";
import type { LiveFeed } from "../domain/live-feed";
import { LiveResult } from "../domain/live-result";
import { InMemoryLiveResultRepository } from "../infrastructure/in-memory-live-result-repository";
import { MockLiveFeed } from "../infrastructure/mock-live-feed";
import { tickLiveFeed } from "./tick-live-feed";

class FakeClock implements Clock {
  constructor(private currentTime: Date) {}
  now(): Date {
    return this.currentTime;
  }
  setCurrentTime(time: Date) {
    this.currentTime = time;
  }
}

class StubLiveFeed implements LiveFeed {
  public snapshot: any = null;
  public error: Error | null = null;

  async fetchSnapshot(_match: Match, _current: LiveResult | null) {
    if (this.error) {
      return err(this.error);
    }
    return ok(this.snapshot);
  }
}

let mockMatches: Match[] = [];

vi.mock("@/modules/schedule", async () => {
  const actual =
    await vi.importActual<typeof import("@/modules/schedule")>(
      "@/modules/schedule",
    );
  return {
    ...actual,
    getAllMatches: () => mockMatches,
  };
});

describe("tickLiveFeed application service", () => {
  const kickoffTime = "13:00 UTC-6"; // Kickoff is 2026-06-11T19:00:00Z
  const mockMatch1: Match = {
    num: 1,
    round: "Group Stage",
    date: "2026-06-11",
    time: kickoffTime,
    team1: "MEX",
    team2: "USA",
    ground: "Stadium",
  };

  const mockMatch2: Match = {
    num: 2,
    round: "Group Stage",
    date: "2026-06-11",
    time: kickoffTime,
    team1: "CAN",
    team2: "CRC",
    ground: "Stadium",
  };

  beforeEach(() => {
    mockMatches = [];
  });

  it("promotes upcoming match or no row past kickoff to live 0-0", async () => {
    mockMatches = [mockMatch1, mockMatch2];
    const repo = new InMemoryLiveResultRepository();
    // seed match2 as upcoming
    await repo.save(
      LiveResult.fromState({
        num: 2,
        status: "upcoming",
        goals1: 0,
        goals2: 0,
      }),
    );

    const clock = new FakeClock(new Date("2026-06-11T19:00:00Z")); // Exactly kickoff
    const feed = new StubLiveFeed();
    // Snapshot return for live matches
    feed.snapshot = {
      goals1: 0,
      goals2: 0,
      finished: false,
    };

    const result = await tickLiveFeed(repo, feed, clock);
    expect(result.isOk()).toBe(true);

    const res1 = await repo.findByNum(1);
    expect(res1).not.toBeNull();
    expect(res1?.status).toBe("live");
    expect(res1?.goals1).toBe(0);
    expect(res1?.goals2).toBe(0);

    const res2 = await repo.findByNum(2);
    expect(res2).not.toBeNull();
    expect(res2?.status).toBe("live");
    expect(res2?.goals1).toBe(0);
    expect(res2?.goals2).toBe(0);
  });

  it("leaves match before kickoff untouched", async () => {
    mockMatches = [mockMatch1];
    const repo = new InMemoryLiveResultRepository();
    const clock = new FakeClock(new Date("2026-06-11T18:59:59Z")); // 1 second before kickoff
    const feed = new StubLiveFeed();

    const result = await tickLiveFeed(repo, feed, clock);
    expect(result.isOk()).toBe(true);

    const res1 = await repo.findByNum(1);
    expect(res1).toBeNull();
  });

  it("keeps manual Admin corrections alive (does not overwrite stored score)", async () => {
    mockMatches = [mockMatch1];
    const repo = new InMemoryLiveResultRepository();
    // Match is already live, but Admin corrected it to 3-1
    await repo.save(
      LiveResult.fromState({
        num: 1,
        status: "live",
        goals1: 3,
        goals2: 1,
      }),
    );

    const clock = new FakeClock(new Date("2026-06-11T20:00:00Z"));
    const feed = new MockLiveFeed(clock);

    const result = await tickLiveFeed(repo, feed, clock);
    expect(result.isOk()).toBe(true);

    const res1 = await repo.findByNum(1);
    expect(res1?.goals1).toBe(3); // Admin correction survived!
    expect(res1?.goals2).toBe(1);
  });

  it("transitions live match to finished when feed reports finished", async () => {
    mockMatches = [mockMatch1];
    const repo = new InMemoryLiveResultRepository();
    await repo.save(
      LiveResult.fromState({
        num: 1,
        status: "live",
        goals1: 2,
        goals2: 2,
      }),
    );

    const clock = new FakeClock(new Date("2026-06-11T21:05:00Z")); // > 120 minutes past kickoff
    const feed = new StubLiveFeed();
    feed.snapshot = {
      goals1: 2,
      goals2: 2,
      finished: true,
    };

    const result = await tickLiveFeed(repo, feed, clock);
    expect(result.isOk()).toBe(true);

    const res1 = await repo.findByNum(1);
    expect(res1?.status).toBe("finished");
  });

  it("never reverts a finished match back to live (latch holds)", async () => {
    mockMatches = [mockMatch1];
    const repo = new InMemoryLiveResultRepository();
    await repo.save(
      LiveResult.fromState({
        num: 1,
        status: "finished",
        goals1: 1,
        goals2: 0,
      }),
    );

    const clock = new FakeClock(new Date("2026-06-11T21:30:00Z"));
    const feed = new StubLiveFeed();
    // Outdated feed reports live match
    feed.snapshot = {
      goals1: 1,
      goals2: 0,
      finished: false,
    };

    const result = await tickLiveFeed(repo, feed, clock);
    expect(result.isOk()).toBe(true);

    const res1 = await repo.findByNum(1);
    expect(res1?.status).toBe("finished"); // Latch holds!
  });

  it("skips bad matches when feed fetchSnapshot fails with Err, still processing others", async () => {
    mockMatches = [mockMatch1, mockMatch2];
    const repo = new InMemoryLiveResultRepository();
    // Both are live
    await repo.save(
      LiveResult.fromState({
        num: 1,
        status: "live",
        goals1: 1,
        goals2: 1,
      }),
    );
    await repo.save(
      LiveResult.fromState({
        num: 2,
        status: "live",
        goals1: 0,
        goals2: 0,
      }),
    );

    const clock = new FakeClock(new Date("2026-06-11T20:00:00Z"));

    // We implement fetchSnapshot to error out specifically for match 1, but succeed for match 2
    const feed: LiveFeed = {
      async fetchSnapshot(match: Match, _current: LiveResult | null) {
        if (match.num === 1) {
          return err(new Error("Network Error for Match 1"));
        }
        return ok({
          goals1: 2,
          goals2: 0,
          finished: false,
        });
      },
    };

    const result = await tickLiveFeed(repo, feed, clock);
    expect(result.isOk()).toBe(true);

    const summary = result._unsafeUnwrap();
    expect(summary.errors).toHaveLength(1);
    expect(summary.errors[0].message).toContain("Network Error for Match 1");

    // Match 1 stays 1-1 because it was skipped
    const res1 = await repo.findByNum(1);
    expect(res1?.goals1).toBe(1);
    expect(res1?.goals2).toBe(1);

    // Match 2 successfully updated to 2-0
    const res2 = await repo.findByNum(2);
    expect(res2?.goals1).toBe(2);
    expect(res2?.goals2).toBe(0);
  });

  describe("live-only processed count", () => {
    it("counts auto-started and already-live matches in processed, excludes finished", async () => {
      // match1: no row → auto-started + polled → counts
      // match2: already live → polled → counts
      // match3: already finished → not polled → does NOT count
      const mockMatch3: Match = {
        num: 3,
        round: "Group Stage",
        date: "2026-06-11",
        time: kickoffTime,
        team1: "BRA",
        team2: "ARG",
        ground: "Stadium",
      };
      mockMatches = [mockMatch1, mockMatch2, mockMatch3];

      const repo = new InMemoryLiveResultRepository();
      await repo.save(
        LiveResult.fromState({ num: 2, status: "live", goals1: 0, goals2: 0 }),
      );
      await repo.save(
        LiveResult.fromState({
          num: 3,
          status: "finished",
          goals1: 1,
          goals2: 0,
        }),
      );

      const clock = new FakeClock(new Date("2026-06-11T20:00:00Z"));
      const feed = new StubLiveFeed();
      feed.snapshot = { goals1: 0, goals2: 0, finished: false };

      const result = await tickLiveFeed(repo, feed, clock);
      expect(result.isOk()).toBe(true);
      const summary = result._unsafeUnwrap();

      // Only match1 (auto-started) and match2 (live) are counted; match3 (finished) is excluded
      expect(summary.processed).toBe(2);
    });

    it("counts a live→finished transition within one Tick in processed", async () => {
      mockMatches = [mockMatch1];
      const repo = new InMemoryLiveResultRepository();
      await repo.save(
        LiveResult.fromState({ num: 1, status: "live", goals1: 1, goals2: 0 }),
      );

      const clock = new FakeClock(new Date("2026-06-11T20:00:00Z"));
      const feed = new StubLiveFeed();
      feed.snapshot = { goals1: 1, goals2: 0, finished: true };

      const result = await tickLiveFeed(repo, feed, clock);
      expect(result.isOk()).toBe(true);
      const summary = result._unsafeUnwrap();

      // The match went live→finished this Tick — it was queried, so it counts
      expect(summary.processed).toBe(1);

      const res = await repo.findByNum(1);
      expect(res?.status).toBe("finished");
    });
  });

  describe("3-hour force-finish", () => {
    // Kickoff is 2026-06-11T19:00:00Z, so 3h boundary = 2026-06-11T22:00:00Z
    const justBefore3h = new Date("2026-06-11T21:59:59Z");
    const exactly3h = new Date("2026-06-11T22:00:00Z");
    const well_past3h = new Date("2026-06-11T23:00:00Z");

    it("does NOT force-finish a live match just before the 3h boundary", async () => {
      mockMatches = [mockMatch1];
      const repo = new InMemoryLiveResultRepository();
      await repo.save(
        LiveResult.fromState({ num: 1, status: "live", goals1: 1, goals2: 0 }),
      );

      const clock = new FakeClock(justBefore3h);
      const feed = new StubLiveFeed();
      // Feed still says not finished
      feed.snapshot = { goals1: 1, goals2: 0, finished: false };

      const result = await tickLiveFeed(repo, feed, clock);
      expect(result.isOk()).toBe(true);

      const res = await repo.findByNum(1);
      expect(res?.status).toBe("live"); // still live, not force-finished
    });

    it("force-finishes a live match at exactly the 3h boundary if feed still not finished", async () => {
      mockMatches = [mockMatch1];
      const repo = new InMemoryLiveResultRepository();
      await repo.save(
        LiveResult.fromState({ num: 1, status: "live", goals1: 2, goals2: 1 }),
      );

      const clock = new FakeClock(exactly3h);
      const feed = new StubLiveFeed();
      // Feed returns live (not finished) even at 3h
      feed.snapshot = { goals1: 2, goals2: 1, finished: false };

      const result = await tickLiveFeed(repo, feed, clock);
      expect(result.isOk()).toBe(true);

      const res = await repo.findByNum(1);
      expect(res?.status).toBe("finished"); // force-finished
      expect(res?.goals1).toBe(2);
      expect(res?.goals2).toBe(1);
    });

    it("does not re-force-finish if feed reports finished at 3h boundary (normal finish takes precedence)", async () => {
      mockMatches = [mockMatch1];
      const repo = new InMemoryLiveResultRepository();
      await repo.save(
        LiveResult.fromState({ num: 1, status: "live", goals1: 1, goals2: 1 }),
      );

      const clock = new FakeClock(exactly3h);
      const feed = new StubLiveFeed();
      // Feed itself says finished — should settle normally, no double-write needed
      feed.snapshot = { goals1: 1, goals2: 1, finished: true };

      const result = await tickLiveFeed(repo, feed, clock);
      expect(result.isOk()).toBe(true);

      const res = await repo.findByNum(1);
      expect(res?.status).toBe("finished");
      expect(res?.goals1).toBe(1);
    });

    it("auto-starts a down-site match (upcoming) well past kickoff, polls once, and force-finishes it", async () => {
      // Simulates a match that was never auto-started (site was down) — still upcoming at 3h+
      mockMatches = [mockMatch1];
      const repo = new InMemoryLiveResultRepository();
      await repo.save(
        LiveResult.fromState({
          num: 1,
          status: "upcoming",
          goals1: 0,
          goals2: 0,
        }),
      );

      const clock = new FakeClock(well_past3h);
      const feed = new StubLiveFeed();
      // The one real poll returns a real final score (site recovered)
      feed.snapshot = { goals1: 3, goals2: 2, finished: false };

      const result = await tickLiveFeed(repo, feed, clock);
      expect(result.isOk()).toBe(true);

      const res = await repo.findByNum(1);
      // Must be force-finished with the polled score
      expect(res?.status).toBe("finished");
      expect(res?.goals1).toBe(3);
      expect(res?.goals2).toBe(2);
    });

    it("auto-starts a never-started match well past kickoff, polls once, and force-finishes it", async () => {
      // No row at all — the match was completely missed
      mockMatches = [mockMatch1];
      const repo = new InMemoryLiveResultRepository();
      // No row in repo

      const clock = new FakeClock(well_past3h);
      const feed = new StubLiveFeed();
      feed.snapshot = { goals1: 2, goals2: 0, finished: false };

      const result = await tickLiveFeed(repo, feed, clock);
      expect(result.isOk()).toBe(true);

      const res = await repo.findByNum(1);
      expect(res?.status).toBe("finished");
      expect(res?.goals1).toBe(2);
      expect(res?.goals2).toBe(0);
    });

    it("does not re-poll or alter an already-finished match past the 3h boundary", async () => {
      mockMatches = [mockMatch1];
      const repo = new InMemoryLiveResultRepository();
      await repo.save(
        LiveResult.fromState({
          num: 1,
          status: "finished",
          goals1: 1,
          goals2: 0,
        }),
      );

      const clock = new FakeClock(well_past3h);
      const feed = new StubLiveFeed();
      // Feed would return wrong data — must never be called
      feed.snapshot = { goals1: 99, goals2: 99, finished: false };

      const result = await tickLiveFeed(repo, feed, clock);
      expect(result.isOk()).toBe(true);

      const res = await repo.findByNum(1);
      expect(res?.status).toBe("finished");
      expect(res?.goals1).toBe(1); // unchanged
      expect(res?.goals2).toBe(0);
    });

    it("force-finish is counted in processed", async () => {
      mockMatches = [mockMatch1];
      const repo = new InMemoryLiveResultRepository();
      await repo.save(
        LiveResult.fromState({ num: 1, status: "live", goals1: 0, goals2: 0 }),
      );

      const clock = new FakeClock(exactly3h);
      const feed = new StubLiveFeed();
      feed.snapshot = { goals1: 0, goals2: 0, finished: false };

      const result = await tickLiveFeed(repo, feed, clock);
      expect(result.isOk()).toBe(true);
      const summary = result._unsafeUnwrap();
      expect(summary.processed).toBe(1);
    });
  });
});
