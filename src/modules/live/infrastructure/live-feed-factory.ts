import type { Clock } from "../domain/clock";
import type { LiveFeed } from "../domain/live-feed";
import type { LiveResultRepository } from "../domain/live-result-repository";
import { ProductionMatchContextResolver } from "./match-context-resolver";
import { MockLiveFeed } from "./mock-live-feed";
import { createOpenAiResponder, OpenAiLiveFeed } from "./openai-live-feed";

export type LiveFeedSource = "mock" | "openai";

export type LiveFeedConfig = {
  /** Which feed to use. Defaults to "mock" when unset or unknown. */
  source?: string;
  /** Model name for the OpenAI feed. Defaults to "gpt-5.4-mini". */
  model?: string;
  /** OpenAI API key. Required when source="openai". */
  apiKey?: string;
};

export type LiveFeedDeps = {
  clock: Clock;
  repo: LiveResultRepository;
};

/**
 * Factory that maps config to the concrete LiveFeed implementation.
 *
 * - source=openai + apiKey present → OpenAiLiveFeed
 * - source=openai + apiKey missing/empty → MockLiveFeed + loud warning (fail-safe)
 * - source=mock, unset, or unknown → MockLiveFeed
 */
export function createLiveFeed(
  config: LiveFeedConfig,
  deps: LiveFeedDeps,
): LiveFeed {
  const { source, model = "gpt-5.4-mini", apiKey } = config;
  const { clock, repo } = deps;

  if (source === "openai") {
    if (!apiKey) {
      console.warn(
        "[LiveFeedFactory] WARNING: LIVE_FEED_SOURCE=openai but OPENAI_API_KEY is missing or empty. " +
          "Falling back to MockLiveFeed (fail-safe). Set OPENAI_API_KEY to enable real data.",
      );
      return new MockLiveFeed(clock);
    }

    const resolver = new ProductionMatchContextResolver(repo);
    const responder = createOpenAiResponder(apiKey, model);
    return new OpenAiLiveFeed(model, resolver, responder);
  }

  // "mock", undefined, or any unknown value
  return new MockLiveFeed(clock);
}
