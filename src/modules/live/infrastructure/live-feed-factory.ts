import type { Clock } from "../domain/clock";
import type { LiveFeed } from "../domain/live-feed";
import { MockLiveFeed } from "./mock-live-feed";
import { RemoteLiveFeed } from "./remote-live-feed";

/** Config read from the environment. Neutral names — no source named. */
export type LiveFeedConfig = {
  /** Value of the LIVE_FEED_SOURCE environment variable, or undefined. */
  liveFeedSource: string | undefined;
};

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Factory that maps the `LIVE_FEED_SOURCE` config value to the concrete
 * `LiveFeed` implementation.
 *
 * Fail-safe: unset or unknown values default to `MockLiveFeed`.
 *
 * @param config       Config object derived from environment variables.
 * @param clock        Clock for the mock feed.
 * @param fetchFn      Optional injected fetch function (for testing RemoteLiveFeed).
 *                     Defaults to the platform `fetch` when constructing RemoteLiveFeed.
 */
export function createLiveFeed(
  config: LiveFeedConfig,
  clock: Clock,
  fetchFn?: FetchFn,
): LiveFeed {
  if (config.liveFeedSource === "remote") {
    return fetchFn ? new RemoteLiveFeed(fetchFn) : new RemoteLiveFeed();
  }

  // Default (fail-safe): mock for unset, "mock", or any unknown value
  return new MockLiveFeed(clock);
}

/**
 * Read the `LiveFeedConfig` from the current process environment.
 */
export function readLiveFeedConfig(): LiveFeedConfig {
  return {
    liveFeedSource: process.env.LIVE_FEED_SOURCE,
  };
}
