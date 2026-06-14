import type { Result } from "neverthrow";
import type { Match } from "@/modules/schedule";
import type { LiveResult } from "./live-result";

export type MatchPhase =
  | "not_started"
  | "first_half"
  | "second_half"
  | "extra_time"
  | "penalties"
  | "finished";

export type LiveFeedSnapshot = {
  goals1: number;
  goals2: number;
  finished: boolean;
  penalties1?: number;
  penalties2?: number;
  phase?: MatchPhase;
  minute?: number | null;
  inStoppage?: boolean;
};

export interface LiveFeed {
  fetchSnapshot(
    match: Match,
    current: LiveResult | null,
  ): Promise<Result<LiveFeedSnapshot, Error>>;
}
