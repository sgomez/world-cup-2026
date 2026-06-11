import type { Clock } from "../domain/clock";
import type { LiveFeed } from "../domain/live-feed";
import { MockLiveFeed } from "./mock-live-feed";
import { Worldcup26LiveFeed } from "./worldcup26-live-feed";

export function createLiveFeed(
  config: { source?: string; baseUrl?: string },
  clock: Clock,
): LiveFeed {
  const source = config.source || "mock";
  const baseUrl = config.baseUrl || "https://worldcup26.ir";

  if (source === "worldcup26") {
    return new Worldcup26LiveFeed(baseUrl, clock);
  }

  return new MockLiveFeed(clock);
}
