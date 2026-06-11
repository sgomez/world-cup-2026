import { err, ok, type Result } from "neverthrow";
import { getKickoffInstant, type Match } from "@/lib/matches";
import type { Clock } from "../domain/clock";
import type { LiveFeed, LiveFeedSnapshot } from "../domain/live-feed";
import type { LiveResult } from "../domain/live-result";

export class MockLiveFeed implements LiveFeed {
  constructor(private readonly clock: Clock) {}

  async fetchSnapshot(
    match: Match,
    current: LiveResult | null,
  ): Promise<Result<LiveFeedSnapshot, Error>> {
    const kickoffRes = getKickoffInstant(match);
    if (kickoffRes.isErr()) {
      return err(kickoffRes.error);
    }

    const kickoff = kickoffRes.value;
    const durationMs = 120 * 60 * 1000;
    const finished =
      this.clock.now().getTime() - kickoff.getTime() >= durationMs;

    return ok({
      goals1: current ? current.goals1 : 0,
      goals2: current ? current.goals2 : 0,
      finished,
      penalties1: current?.penalties1,
      penalties2: current?.penalties2,
    });
  }
}
