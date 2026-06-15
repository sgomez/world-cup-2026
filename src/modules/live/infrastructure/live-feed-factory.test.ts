import { describe, expect, it } from "vitest";
import type { Clock } from "../domain/clock";
import { createLiveFeed } from "./live-feed-factory";
import { MockLiveFeed } from "./mock-live-feed";
import { RemoteLiveFeed } from "./remote-live-feed";

class FakeClock implements Clock {
  now(): Date {
    return new Date("2026-06-11T20:00:00Z");
  }
}

describe("createLiveFeed factory", () => {
  it("returns MockLiveFeed when LIVE_FEED_SOURCE is unset", () => {
    const feed = createLiveFeed({ liveFeedSource: undefined }, new FakeClock());
    expect(feed).toBeInstanceOf(MockLiveFeed);
  });

  it("returns MockLiveFeed when LIVE_FEED_SOURCE is 'mock'", () => {
    const feed = createLiveFeed({ liveFeedSource: "mock" }, new FakeClock());
    expect(feed).toBeInstanceOf(MockLiveFeed);
  });

  it("returns MockLiveFeed for unknown values (fail-safe)", () => {
    const feed = createLiveFeed(
      { liveFeedSource: "unknown-source" },
      new FakeClock(),
    );
    expect(feed).toBeInstanceOf(MockLiveFeed);
  });

  it("returns RemoteLiveFeed when LIVE_FEED_SOURCE is 'remote'", () => {
    const feed = createLiveFeed({ liveFeedSource: "remote" }, new FakeClock());
    expect(feed).toBeInstanceOf(RemoteLiveFeed);
  });

  it("accepts an injected fetchFn for RemoteLiveFeed (testability)", () => {
    const fakeFetch = async () => ({ ok: true }) as Response;
    const feed = createLiveFeed(
      { liveFeedSource: "remote" },
      new FakeClock(),
      fakeFetch,
    );
    expect(feed).toBeInstanceOf(RemoteLiveFeed);
  });
});
