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

  describe("processed count reports only polled live matches", () => {
    it("counts a live match that stays live after polling once", async () => {
      mockMatches = [mockMatch1];
      const repo = new InMemoryLiveResultRepository();
      await repo.save(
        LiveResult.fromState({
          num: 1,
          status: "live",
          goals1: 0,
          goals2: 0,
        }),
      );

      const clock = new FakeClock(new Date("2026-06-11T20:00:00Z"));
      const feed = new StubLiveFeed();
      feed.snapshot = { goals1: 1, goals2: 0, finished: false };

      const result = await tickLiveFeed(repo, feed, clock);
      expect(result._unsafeUnwrap().processed).toBe(1);
    });

    it("counts an auto-started match polled in the same tick", async () => {
      mockMatches = [mockMatch1];
      const repo = new InMemoryLiveResultRepository();

      const clock = new FakeClock(new Date("2026-06-11T19:00:00Z"));
      const feed = new StubLiveFeed();
      feed.snapshot = { goals1: 0, goals2: 0, finished: false };

      const result = await tickLiveFeed(repo, feed, clock);
      expect(result._unsafeUnwrap().processed).toBe(1);
    });

    it("counts a match that goes live to finished within the same tick", async () => {
      mockMatches = [mockMatch1];
      const repo = new InMemoryLiveResultRepository();
      await repo.save(
        LiveResult.fromState({
          num: 1,
          status: "live",
          goals1: 2,
          goals2: 1,
        }),
      );

      const clock = new FakeClock(new Date("2026-06-11T21:05:00Z"));
      const feed = new StubLiveFeed();
      feed.snapshot = { goals1: 2, goals2: 1, finished: true };

      const result = await tickLiveFeed(repo, feed, clock);
      expect(result._unsafeUnwrap().processed).toBe(1);

      const res1 = await repo.findByNum(1);
      expect(res1?.status).toBe("finished");
    });

    it("does not count a match already finished from a prior cycle", async () => {
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
      feed.snapshot = { goals1: 1, goals2: 0, finished: true };

      const result = await tickLiveFeed(repo, feed, clock);
      expect(result._unsafeUnwrap().processed).toBe(0);
    });

    it("does not count a match before its kickoff", async () => {
      mockMatches = [mockMatch1];
      const repo = new InMemoryLiveResultRepository();

      const clock = new FakeClock(new Date("2026-06-11T18:59:59Z"));
      const feed = new StubLiveFeed();
      feed.snapshot = { goals1: 0, goals2: 0, finished: false };

      const result = await tickLiveFeed(repo, feed, clock);
      expect(result._unsafeUnwrap().processed).toBe(0);
    });

    it("does not count a match whose poll errored (it lands in errors)", async () => {
      mockMatches = [mockMatch1];
      const repo = new InMemoryLiveResultRepository();
      await repo.save(
        LiveResult.fromState({
          num: 1,
          status: "live",
          goals1: 0,
          goals2: 0,
        }),
      );

      const clock = new FakeClock(new Date("2026-06-11T20:00:00Z"));
      const feed = new StubLiveFeed();
      feed.error = new Error("poll failed");

      const result = await tickLiveFeed(repo, feed, clock);
      const summary = result._unsafeUnwrap();
      expect(summary.processed).toBe(0);
      expect(summary.errors).toHaveLength(1);
    });

    it("counts only polled matches across a mixed batch", async () => {
      // match1 live (polled, counts), match2 finished prior cycle (not counted)
      mockMatches = [mockMatch1, mockMatch2];
      const repo = new InMemoryLiveResultRepository();
      await repo.save(
        LiveResult.fromState({
          num: 1,
          status: "live",
          goals1: 0,
          goals2: 0,
        }),
      );
      await repo.save(
        LiveResult.fromState({
          num: 2,
          status: "finished",
          goals1: 1,
          goals2: 1,
        }),
      );

      const clock = new FakeClock(new Date("2026-06-11T20:00:00Z"));
      const feed = new StubLiveFeed();
      feed.snapshot = { goals1: 1, goals2: 0, finished: false };

      const result = await tickLiveFeed(repo, feed, clock);
      expect(result._unsafeUnwrap().processed).toBe(1);
    });
  });
});
