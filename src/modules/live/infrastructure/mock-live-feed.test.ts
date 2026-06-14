import { describe, expect, it } from "vitest";
import type { Match } from "@/modules/schedule";
import type { Clock } from "../domain/clock";
import { LiveResult } from "../domain/live-result";
import { MockLiveFeed } from "./mock-live-feed";

class FakeClock implements Clock {
  constructor(private currentTime: Date) {}
  now(): Date {
    return this.currentTime;
  }
  setCurrentTime(time: Date) {
    this.currentTime = time;
  }
}

describe("MockLiveFeed", () => {
  const mockMatch: Match = {
    num: 1,
    round: "Group Stage",
    date: "2026-06-11",
    time: "13:00 UTC-6",
    team1: "MEX",
    team2: "USA",
    ground: "Stadium",
  };

  it("returns error if kickoff is invalid or missing", async () => {
    const clock = new FakeClock(new Date("2026-06-11T13:00:00-06:00"));
    const feed = new MockLiveFeed(clock);
    const result = await feed.fetchSnapshot({ ...mockMatch, date: "" }, null);
    expect(result.isErr()).toBe(true);
  });

  it("echoes current scoreline and penalties", async () => {
    const clock = new FakeClock(new Date("2026-06-11T13:00:00-06:00"));
    const feed = new MockLiveFeed(clock);
    const current = LiveResult.fromState({
      num: 1,
      status: "live",
      goals1: 3,
      goals2: 2,
    });
    const result = await feed.fetchSnapshot(mockMatch, current);
    expect(result.isOk()).toBe(true);
    const snapshot = result._unsafeUnwrap();
    expect(snapshot.goals1).toBe(3);
    expect(snapshot.goals2).toBe(2);
    expect(snapshot.penalties1).toBeUndefined();
    expect(snapshot.penalties2).toBeUndefined();
  });

  it("echoes current penalties for knockout matches", async () => {
    const clock = new FakeClock(new Date("2026-06-11T13:00:00-06:00"));
    const feed = new MockLiveFeed(clock);
    const current = LiveResult.fromState({
      num: 73,
      status: "live",
      goals1: 1,
      goals2: 1,
      penalties1: 5,
      penalties2: 4,
    });
    const result = await feed.fetchSnapshot({ ...mockMatch, num: 73 }, current);
    expect(result.isOk()).toBe(true);
    const snapshot = result._unsafeUnwrap();
    expect(snapshot.goals1).toBe(1);
    expect(snapshot.goals2).toBe(1);
    expect(snapshot.penalties1).toBe(5);
    expect(snapshot.penalties2).toBe(4);
  });

  it("reports finished is false before 120 minutes past kickoff", async () => {
    // Kickoff: 2026-06-11T13:00:00-06:00 (which is 19:00:00 UTC)
    // 119 minutes past kickoff: 2026-06-11T14:59:00-06:00 (which is 20:59:00 UTC)
    const clock = new FakeClock(new Date("2026-06-11T14:59:00-06:00"));
    const feed = new MockLiveFeed(clock);
    const result = await feed.fetchSnapshot(mockMatch, null);
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().finished).toBe(false);
  });

  it("reports finished is true at or after 120 minutes past kickoff", async () => {
    // 120 minutes past kickoff
    const clock = new FakeClock(new Date("2026-06-11T15:00:00-06:00"));
    const feed = new MockLiveFeed(clock);
    const result1 = await feed.fetchSnapshot(mockMatch, null);
    expect(result1.isOk()).toBe(true);
    expect(result1._unsafeUnwrap().finished).toBe(true);

    // 130 minutes past kickoff
    clock.setCurrentTime(new Date("2026-06-11T15:10:00-06:00"));
    const result2 = await feed.fetchSnapshot(mockMatch, null);
    expect(result2.isOk()).toBe(true);
    expect(result2._unsafeUnwrap().finished).toBe(true);
  });

  describe("phase and minute derivation", () => {
    // Kickoff: 2026-06-11T13:00:00-06:00 = 2026-06-11T19:00:00Z

    it("returns first_half phase for elapsed time 0–44 minutes", async () => {
      // 20 minutes elapsed
      const clock = new FakeClock(new Date("2026-06-11T19:20:00Z"));
      const feed = new MockLiveFeed(clock);
      const result = await feed.fetchSnapshot(mockMatch, null);
      expect(result.isOk()).toBe(true);
      const snapshot = result._unsafeUnwrap();
      expect(snapshot.phase).toBe("first_half");
      expect(snapshot.minute).toBe(20);
      expect(snapshot.inStoppage).toBe(false);
      expect(snapshot.finished).toBe(false);
    });

    it("returns second_half phase for elapsed time 45–89 minutes", async () => {
      // 60 minutes elapsed
      const clock = new FakeClock(new Date("2026-06-11T20:00:00Z"));
      const feed = new MockLiveFeed(clock);
      const result = await feed.fetchSnapshot(mockMatch, null);
      expect(result.isOk()).toBe(true);
      const snapshot = result._unsafeUnwrap();
      expect(snapshot.phase).toBe("second_half");
      expect(snapshot.minute).toBe(60);
      expect(snapshot.inStoppage).toBe(false);
      expect(snapshot.finished).toBe(false);
    });

    it("returns extra_time phase for elapsed time 90–119 minutes", async () => {
      // 100 minutes elapsed
      const clock = new FakeClock(new Date("2026-06-11T20:40:00Z"));
      const feed = new MockLiveFeed(clock);
      const result = await feed.fetchSnapshot(mockMatch, null);
      expect(result.isOk()).toBe(true);
      const snapshot = result._unsafeUnwrap();
      expect(snapshot.phase).toBe("extra_time");
      expect(snapshot.minute).toBe(100);
      expect(snapshot.inStoppage).toBe(false);
      expect(snapshot.finished).toBe(false);
    });

    it("returns finished phase with null minute at 120+ minutes", async () => {
      // 120 minutes elapsed
      const clock = new FakeClock(new Date("2026-06-11T21:00:00Z"));
      const feed = new MockLiveFeed(clock);
      const result = await feed.fetchSnapshot(mockMatch, null);
      expect(result.isOk()).toBe(true);
      const snapshot = result._unsafeUnwrap();
      expect(snapshot.phase).toBe("finished");
      expect(snapshot.minute).toBeNull();
      expect(snapshot.finished).toBe(true);
    });

    it("returns first_half at minute 0 at kickoff", async () => {
      const clock = new FakeClock(new Date("2026-06-11T19:00:00Z"));
      const feed = new MockLiveFeed(clock);
      const result = await feed.fetchSnapshot(mockMatch, null);
      expect(result.isOk()).toBe(true);
      const snapshot = result._unsafeUnwrap();
      expect(snapshot.phase).toBe("first_half");
      expect(snapshot.minute).toBe(0);
    });
  });
});
