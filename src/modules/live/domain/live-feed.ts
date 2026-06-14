import type { Result } from "neverthrow";
import type { Match } from "@/modules/schedule";
import type { LiveResult } from "./live-result";

export type LiveFeedSnapshot = {
  goals1: number;
  goals2: number;
  finished: boolean;
  penalties1?: number;
  penalties2?: number;
};

export interface LiveFeed {
  fetchSnapshot(
    match: Match,
    current: LiveResult | null,
  ): Promise<Result<LiveFeedSnapshot, Error>>;
}
