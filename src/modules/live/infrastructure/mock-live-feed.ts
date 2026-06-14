import { err, ok, type Result } from "neverthrow";
import { getKickoffInstant, type Match } from "@/modules/schedule";
import type { Clock } from "../domain/clock";
import type {
  LiveFeed,
  LiveFeedSnapshot,
  MatchPhase,
} from "../domain/live-feed";
import type { LiveResult } from "../domain/live-result";

/**
 * Derive phase and minute from elapsed time since kickoff.
 *
 * Nominal schedule:
 *   0–45  min → first_half   (minute 0..45)
 *   45–90 min → second_half  (minute 45..90)
 *   90–120min → extra_time   (minute 90..120)
 *   ≥120  min → finished
 *
 * The mock does not model a real stoppage-time buffer or penalties — it
 * uses sharp minute boundaries so tests are deterministic.
 */
function derivePhaseAndMinute(elapsedMs: number): {
  phase: MatchPhase;
  minute: number | null;
  inStoppage: boolean;
  finished: boolean;
} {
  const elapsedMin = Math.floor(elapsedMs / (60 * 1000));

  if (elapsedMin < 0) {
    return {
      phase: "not_started",
      minute: 0,
      inStoppage: false,
      finished: false,
    };
  }
  if (elapsedMin < 45) {
    return {
      phase: "first_half",
      minute: elapsedMin,
      inStoppage: false,
      finished: false,
    };
  }
  if (elapsedMin < 90) {
    return {
      phase: "second_half",
      minute: elapsedMin,
      inStoppage: false,
      finished: false,
    };
  }
  if (elapsedMin < 120) {
    return {
      phase: "extra_time",
      minute: elapsedMin,
      inStoppage: false,
      finished: false,
    };
  }
  return { phase: "finished", minute: null, inStoppage: false, finished: true };
}

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
    const elapsedMs = this.clock.now().getTime() - kickoff.getTime();
    const { phase, minute, inStoppage, finished } =
      derivePhaseAndMinute(elapsedMs);

    return ok({
      goals1: current ? current.goals1 : 0,
      goals2: current ? current.goals2 : 0,
      finished,
      penalties1: current?.penalties1,
      penalties2: current?.penalties2,
      phase,
      minute,
      inStoppage,
    });
  }
}
