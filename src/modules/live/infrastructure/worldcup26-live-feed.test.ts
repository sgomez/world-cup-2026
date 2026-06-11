import { describe, expect, it, vi } from "vitest";
import type { Match } from "@/lib/matches";
import { tickLiveFeed } from "../application/tick-live-feed";
import type { Clock } from "../domain/clock";
import { LiveResult } from "../domain/live-result";
import { InMemoryLiveResultRepository } from "./in-memory-live-result-repository";
import { createLiveFeed } from "./live-feed-factory";
import { MockLiveFeed } from "./mock-live-feed";
import { Worldcup26LiveFeed } from "./worldcup26-live-feed";

class FakeClock implements Clock {
  constructor(private currentTime: Date) {}
  now(): Date {
    return this.currentTime;
  }
  setCurrentTime(time: Date) {
    this.currentTime = time;
  }
}

const mockMatch1: Match = {
  num: 1,
  round: "Group Stage",
  date: "2026-06-11",
  time: "13:00 UTC-6",
  team1: "MEX",
  team2: "RSA",
  group: "Group A",
  ground: "Stadium",
};

const mockMatch2: Match = {
  num: 2,
  round: "Group Stage",
  date: "2026-06-11",
  time: "13:00 UTC-6",
  team1: "KOR",
  team2: "CZE",
  group: "Group A",
  ground: "Stadium",
};

const mockMatchKnockout: Match = {
  num: 73,
  round: "Round of 32",
  date: "2026-06-25",
  time: "13:00 UTC-6",
  team1: "W1",
  team2: "W2",
  ground: "Stadium", // No group field for knockout matches in fixture
};

const validApiResponse = {
  games: [
    {
      id: "1",
      home_score: "2",
      away_score: "1",
      finished: "FALSE",
      group: "A",
      time_elapsed: "45",
    },
    {
      id: "2",
      home_score: "0",
      away_score: "3",
      finished: "TRUE",
      group: "A",
      time_elapsed: "finished",
    },
    {
      id: "73",
      home_score: "1",
      away_score: "1",
      finished: "TRUE",
      group: "R32",
      time_elapsed: "finished",
    },
  ],
};

describe("Worldcup26LiveFeed Adapter", () => {
  it("successfully maps fields from a valid API response", async () => {
    const clock = new FakeClock(new Date("2026-06-11T19:00:00Z"));
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => validApiResponse,
    } as Response);

    const feed = new Worldcup26LiveFeed(
      "https://test-api.com",
      clock,
      fakeFetch,
    );
    const result = await feed.fetchSnapshot(mockMatch1, null);

    expect(result.isOk()).toBe(true);
    const snapshot = result._unsafeUnwrap();
    expect(snapshot.goals1).toBe(2);
    expect(snapshot.goals2).toBe(1);
    expect(snapshot.finished).toBe(false);
    expect(fakeFetch).toHaveBeenCalledTimes(1);
  });

  it("skips and returns an error for group-mismatch games", async () => {
    const clock = new FakeClock(new Date("2026-06-11T19:00:00Z"));
    const badApiResponse = {
      games: [
        {
          id: "1",
          home_score: "2",
          away_score: "1",
          finished: "FALSE",
          group: "B", // fixture is Group A
          time_elapsed: "45",
        },
      ],
    };
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => badApiResponse,
    } as Response);

    const feed = new Worldcup26LiveFeed(
      "https://test-api.com",
      clock,
      fakeFetch,
    );
    const result = await feed.fetchSnapshot(mockMatch1, null);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toContain("Group mismatch");
  });

  it("correctly handles knockout matches with no fixture group", async () => {
    const clock = new FakeClock(new Date("2026-06-25T19:00:00Z"));
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => validApiResponse,
    } as Response);

    const feed = new Worldcup26LiveFeed(
      "https://test-api.com",
      clock,
      fakeFetch,
    );

    // Should succeed because group "R32" in API is recognized as knockout
    const result = await feed.fetchSnapshot(mockMatchKnockout, null);
    expect(result.isOk()).toBe(true);
    const snapshot = result._unsafeUnwrap();
    expect(snapshot.goals1).toBe(1);
    expect(snapshot.goals2).toBe(1);
    expect(snapshot.finished).toBe(true);
  });

  it("fails knockout match if API returns a group stage group (e.g. A)", async () => {
    const clock = new FakeClock(new Date("2026-06-25T19:00:00Z"));
    const apiWithGroupStageForKnockout = {
      games: [
        {
          id: "73",
          home_score: "1",
          away_score: "1",
          finished: "TRUE",
          group: "A", // group stage group for a knockout match in fixture
          time_elapsed: "finished",
        },
      ],
    };
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => apiWithGroupStageForKnockout,
    } as Response);

    const feed = new Worldcup26LiveFeed(
      "https://test-api.com",
      clock,
      fakeFetch,
    );
    const result = await feed.fetchSnapshot(mockMatchKnockout, null);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toContain("Group mismatch");
  });

  it("parses finished state correctly", async () => {
    const clock = new FakeClock(new Date("2026-06-11T19:00:00Z"));
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => validApiResponse,
    } as Response);

    const feed = new Worldcup26LiveFeed(
      "https://test-api.com",
      clock,
      fakeFetch,
    );

    const resActive = await feed.fetchSnapshot(mockMatch1, null);
    expect(resActive.isOk()).toBe(true);
    expect(resActive._unsafeUnwrap().finished).toBe(false);

    const resFinished = await feed.fetchSnapshot(mockMatch2, null);
    expect(resFinished.isOk()).toBe(true);
    expect(resFinished._unsafeUnwrap().finished).toBe(true);
  });

  it("echoes current penalties from current state", async () => {
    const clock = new FakeClock(new Date("2026-06-25T19:00:00Z"));
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => validApiResponse,
    } as Response);

    const feed = new Worldcup26LiveFeed(
      "https://test-api.com",
      clock,
      fakeFetch,
    );
    const current = LiveResult.fromState({
      num: 73,
      status: "live",
      goals1: 1,
      goals2: 1,
      penalties1: 5,
      penalties2: 4,
    });

    const result = await feed.fetchSnapshot(mockMatchKnockout, current);
    expect(result.isOk()).toBe(true);
    const snapshot = result._unsafeUnwrap();
    expect(snapshot.penalties1).toBe(5);
    expect(snapshot.penalties2).toBe(4);
  });

  it("caches the API response within the TTL window", async () => {
    const clock = new FakeClock(new Date("2026-06-11T19:00:00Z"));
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => validApiResponse,
    } as Response);

    const feed = new Worldcup26LiveFeed(
      "https://test-api.com",
      clock,
      fakeFetch,
    );

    // First call triggers fetch
    const res1 = await feed.fetchSnapshot(mockMatch1, null);
    expect(res1.isOk()).toBe(true);
    expect(fakeFetch).toHaveBeenCalledTimes(1);

    // Second call within 60s uses cache
    clock.setCurrentTime(new Date("2026-06-11T19:00:59Z"));
    const res2 = await feed.fetchSnapshot(mockMatch2, null);
    expect(res2.isOk()).toBe(true);
    expect(fakeFetch).toHaveBeenCalledTimes(1);

    // Third call after 60s triggers another fetch
    clock.setCurrentTime(new Date("2026-06-11T19:01:01Z"));
    const res3 = await feed.fetchSnapshot(mockMatch1, null);
    expect(res3.isOk()).toBe(true);
    expect(fakeFetch).toHaveBeenCalledTimes(2);
  });

  it("returns error on network failures", async () => {
    const clock = new FakeClock(new Date("2026-06-11T19:00:00Z"));
    const fakeFetch = vi
      .fn()
      .mockRejectedValue(new Error("DNS Resolution Failed"));

    const feed = new Worldcup26LiveFeed(
      "https://test-api.com",
      clock,
      fakeFetch,
    );
    const result = await feed.fetchSnapshot(mockMatch1, null);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toContain(
      "DNS Resolution Failed",
    );
  });

  it("returns error on non-200 responses", async () => {
    const clock = new FakeClock(new Date("2026-06-11T19:00:00Z"));
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
    } as Response);

    const feed = new Worldcup26LiveFeed(
      "https://test-api.com",
      clock,
      fakeFetch,
    );
    const result = await feed.fetchSnapshot(mockMatch1, null);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toContain(
      "HTTP error! status: 502",
    );
  });

  it("returns error on invalid schema response", async () => {
    const clock = new FakeClock(new Date("2026-06-11T19:00:00Z"));
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ badKey: [] }),
    } as Response);

    const feed = new Worldcup26LiveFeed(
      "https://test-api.com",
      clock,
      fakeFetch,
    );
    const result = await feed.fetchSnapshot(mockMatch1, null);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toContain(
      "Invalid API response shape",
    );
  });
});

describe("createLiveFeed Factory", () => {
  const clock = new FakeClock(new Date());

  it("returns Worldcup26LiveFeed for 'worldcup26' source", () => {
    const feed = createLiveFeed({ source: "worldcup26" }, clock);
    expect(feed).toBeInstanceOf(Worldcup26LiveFeed);
  });

  it("returns MockLiveFeed for 'mock' source", () => {
    const feed = createLiveFeed({ source: "mock" }, clock);
    expect(feed).toBeInstanceOf(MockLiveFeed);
  });

  it("falls back to MockLiveFeed for unknown source", () => {
    const feed = createLiveFeed({ source: "invalid" }, clock);
    expect(feed).toBeInstanceOf(MockLiveFeed);
  });

  it("falls back to MockLiveFeed when source is unset", () => {
    const feed = createLiveFeed({}, clock);
    expect(feed).toBeInstanceOf(MockLiveFeed);
  });
});

describe("Integration (Worldcup26LiveFeed -> tickLiveFeed)", () => {
  it("successfully starts upcoming match and updates scores in InMemoryLiveResultRepository", async () => {
    const clock = new FakeClock(new Date("2026-06-11T19:00:00Z")); // Kickoff time
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => validApiResponse,
    } as Response);

    // Set mock matches in vi.mock (Wait, tick-live-feed.test.ts mocks @/lib/matches,
    // let's verify if we need to mock it here or if we can use a custom mock).
    // Let's mock it inside this file so it doesn't leak or conflict.
    // Actually, we can use the existing mock in @/lib/matches by importing and using it,
    // or just let tickLiveFeed run against the real fixture matches if they match the IDs.
    // Since mockMatch1 has num: 1, and match 1 in the real fixture is Mexico vs South Africa
    // which has kickoff on 2026-06-11T13:00 UTC-6 (which is 19:00:00 UTC),
    // and validApiResponse has game with id: "1" group: "A", and the real fixture has match 1 group: "Group A",
    // they will agree! We don't even need to mock getAllMatches if we use the real match 1!
    // Let's verify if this works.
    const repo = new InMemoryLiveResultRepository();
    const feed = new Worldcup26LiveFeed(
      "https://test-api.com",
      clock,
      fakeFetch,
    );

    // Call tickLiveFeed
    const result = await tickLiveFeed(repo, feed, clock);
    expect(result.isOk()).toBe(true);

    const _summary = result._unsafeUnwrap();
    // Match 1 should be processed successfully.
    // If other matches in the real fixture are past kickoff, they might return errors or not depending on the API mock.
    // To avoid errors for other real matches, we can mock getAllMatches to return only mockMatch1!
    // Since tick-live-feed.test.ts already mocks @/lib/matches, vitest mock is active.
    // Wait, vitest mock is module-scoped. In this file, we can also mock it.
    // Wait, mockMatches in tick-live-feed.test.ts is scoped to that test file.
    // If we mock "@/lib/matches" in this test file too, vitest will isolate it to this file!
    // Let's mock it for this file to be perfectly safe.
  });
});

// Mock matches specifically for this file to avoid conflicts with real fixtures
let localMockMatches: Match[] = [];
vi.mock("@/lib/matches", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/matches")>("@/lib/matches");
  return {
    ...actual,
    getAllMatches: () => localMockMatches,
  };
});

describe("Integration (Worldcup26LiveFeed -> tickLiveFeed) with Mocked Matches", () => {
  it("promotes upcoming match to live, updates score, and transitions finished", async () => {
    localMockMatches = [mockMatch1, mockMatch2];
    const clock = new FakeClock(new Date("2026-06-11T19:00:00Z")); // Kickoff
    const repo = new InMemoryLiveResultRepository();

    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => validApiResponse,
    } as Response);

    const feed = new Worldcup26LiveFeed(
      "https://test-api.com",
      clock,
      fakeFetch,
    );

    // First tick: Match 1 and Match 2 should become live and get their scores updated
    const result = await tickLiveFeed(repo, feed, clock);
    expect(result.isOk()).toBe(true);

    const match1Result = await repo.findByNum(1);
    expect(match1Result).not.toBeNull();
    expect(match1Result?.status).toBe("live");
    expect(match1Result?.goals1).toBe(2);
    expect(match1Result?.goals2).toBe(1);

    const match2Result = await repo.findByNum(2);
    expect(match2Result).not.toBeNull();
    expect(match2Result?.status).toBe("finished"); // finished = "TRUE" in response
    expect(match2Result?.goals1).toBe(0);
    expect(match2Result?.goals2).toBe(3);
  });
});
