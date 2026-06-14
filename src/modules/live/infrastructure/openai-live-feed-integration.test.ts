import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Match } from "@/modules/schedule";
import { tickLiveFeed } from "../application/tick-live-feed";
import type { Clock } from "../domain/clock";
import { InMemoryLiveResultRepository } from "./in-memory-live-result-repository";
import { StubMatchContextResolver } from "./match-context-resolver.stub";
import { OpenAiLiveFeed } from "./openai-live-feed";

class FakeClock implements Clock {
  constructor(private currentTime: Date) {}
  now(): Date {
    return this.currentTime;
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

describe("OpenAiLiveFeed integration: wired through tickLiveFeed", () => {
  const kickoffTime = "13:00 UTC-6"; // 2026-06-11T19:00:00Z

  const groupMatch: Match = {
    num: 1,
    round: "Group A",
    date: "2026-06-11",
    time: kickoffTime,
    team1: "Mexico",
    team2: "United States",
    ground: "Mexico City",
    group: "Group A",
  };

  const knockoutMatch: Match = {
    num: 73,
    round: "Round of 32",
    date: "2026-06-28",
    time: "12:00 UTC-7",
    team1: "2A",
    team2: "2B",
    ground: "Los Angeles (Inglewood)",
  };

  beforeEach(() => {
    mockMatches = [];
  });

  it("group match: lands scoreline + phase/minute from canned responder", async () => {
    mockMatches = [groupMatch];
    const repo = new InMemoryLiveResultRepository();

    const resolver = new StubMatchContextResolver();
    const responder = async (_prompt: any) => ({
      dataFound: true,
      homeTeam: "Mexico",
      awayTeam: "United States",
      phase: "first_half",
      minute: 22,
      inStoppage: false,
      homeGoals: 1,
      awayGoals: 0,
      homePenalties: null,
      awayPenalties: null,
      sourceUrl: "https://example.com",
    });

    const feed = new OpenAiLiveFeed("gpt-5.4-mini", resolver, responder);
    const clock = new FakeClock(new Date("2026-06-11T19:30:00Z")); // 30 min after kickoff

    const result = await tickLiveFeed(repo, feed, clock);
    expect(result.isOk()).toBe(true);

    const liveResult = await repo.findByNum(1);
    expect(liveResult).not.toBeNull();
    expect(liveResult?.status).toBe("live");
    expect(liveResult?.goals1).toBe(1);
    expect(liveResult?.goals2).toBe(0);
    expect(liveResult?.phase).toBe("first_half");
    expect(liveResult?.minute).toBe(22);
    expect(liveResult?.inStoppage).toBe(false);
  });

  it("knockout match: lands scoreline + phase/minute (resolver provides team names)", async () => {
    mockMatches = [knockoutMatch];
    const repo = new InMemoryLiveResultRepository();

    const resolver = new StubMatchContextResolver();
    resolver.set(73, { home: "Brazil", away: "Argentina" });

    const responder = async (_prompt: any) => ({
      dataFound: true,
      homeTeam: "Brazil",
      awayTeam: "Argentina",
      phase: "second_half",
      minute: 70,
      inStoppage: false,
      homeGoals: 2,
      awayGoals: 1,
      homePenalties: null,
      awayPenalties: null,
      sourceUrl: null,
    });

    const feed = new OpenAiLiveFeed("gpt-5.4-mini", resolver, responder);
    // Use a time well past kickoff for match 73 (June 28)
    const clock = new FakeClock(new Date("2026-06-28T20:10:00Z")); // ~70 min after 12:00 UTC-7 = 19:00Z

    const result = await tickLiveFeed(repo, feed, clock);
    expect(result.isOk()).toBe(true);

    const liveResult = await repo.findByNum(73);
    expect(liveResult).not.toBeNull();
    expect(liveResult?.status).toBe("live");
    expect(liveResult?.goals1).toBe(2);
    expect(liveResult?.goals2).toBe(1);
    expect(liveResult?.phase).toBe("second_half");
    expect(liveResult?.minute).toBe(70);
  });

  it("knockout shootout: lands penalties", async () => {
    mockMatches = [knockoutMatch];
    const repo = new InMemoryLiveResultRepository();

    const resolver = new StubMatchContextResolver();
    resolver.set(73, { home: "Brazil", away: "Argentina" });

    const responder = async (_prompt: any) => ({
      dataFound: true,
      homeTeam: "Brazil",
      awayTeam: "Argentina",
      phase: "finished",
      minute: null,
      inStoppage: false,
      homeGoals: 1,
      awayGoals: 1,
      homePenalties: 5,
      awayPenalties: 4,
      sourceUrl: null,
    });

    const feed = new OpenAiLiveFeed("gpt-5.4-mini", resolver, responder);
    const clock = new FakeClock(new Date("2026-06-28T21:30:00Z")); // well past kickoff

    const result = await tickLiveFeed(repo, feed, clock);
    expect(result.isOk()).toBe(true);

    const liveResult = await repo.findByNum(73);
    expect(liveResult).not.toBeNull();
    expect(liveResult?.status).toBe("finished");
    expect(liveResult?.goals1).toBe(1);
    expect(liveResult?.goals2).toBe(1);
    expect(liveResult?.penalties1).toBe(5);
    expect(liveResult?.penalties2).toBe(4);
  });

  it("resolver null → Err for that match; group match in same Tick still succeeds", async () => {
    // Use a knockout match on the same date as the group match so both are
    // within 3h of kickoff with the same clock (avoids force-finish on the group match).
    const sameDay73: Match = {
      num: 73,
      round: "Round of 32",
      date: "2026-06-11",
      time: "14:00 UTC-6", // 20:00 UTC — 30 min before clock
      team1: "2A",
      team2: "2B",
      ground: "Los Angeles (Inglewood)",
    };

    mockMatches = [groupMatch, sameDay73];
    const repo = new InMemoryLiveResultRepository();

    const resolver = new StubMatchContextResolver();
    // resolver cannot determine knockout participants
    resolver.set(73, null);

    const responder = async (_prompt: any) => ({
      dataFound: true,
      homeTeam: "Mexico",
      awayTeam: "United States",
      phase: "first_half",
      minute: 10,
      inStoppage: false,
      homeGoals: 0,
      awayGoals: 0,
      homePenalties: null,
      awayPenalties: null,
      sourceUrl: null,
    });

    const feed = new OpenAiLiveFeed("gpt-5.4-mini", resolver, responder);
    // 20:30 UTC: group match (19:00 UTC) is 90 min past kickoff (within 3h),
    // knockout match (20:00 UTC) is 30 min past kickoff (within 3h).
    const clock = new FakeClock(new Date("2026-06-11T20:30:00Z"));

    const result = await tickLiveFeed(repo, feed, clock);
    expect(result.isOk()).toBe(true);

    const summary = result._unsafeUnwrap();
    // Knockout errored (resolver returned null), group succeeded
    expect(summary.errors).toHaveLength(1);
    expect(summary.errors[0].message).toMatch(/resolver/i);

    // Group match should have been processed successfully and is live
    const groupResult = await repo.findByNum(1);
    expect(groupResult).not.toBeNull();
    expect(groupResult?.status).toBe("live");
  });
});
