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
});
