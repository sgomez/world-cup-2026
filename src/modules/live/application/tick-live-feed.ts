import { errAsync, okAsync, ResultAsync } from "neverthrow";
import {
  getAllMatches,
  getKickoffInstant,
  type Match,
} from "@/modules/schedule";
import type { Clock } from "../domain/clock";
import type { LiveFeed } from "../domain/live-feed";
import type { LiveResult } from "../domain/live-result";
import type { LiveResultRepository } from "../domain/live-result-repository";
import { upsertLiveResult } from "./upsert-live-result";

export type TickSummary = {
  processed: number;
  errors: Error[];
};

/**
 * 3-hour window after kickoff after which a still-live match is force-finished.
 * Covers 90 min regulation + stoppage + extra time + penalties + kickoff delay.
 */
const FORCE_FINISH_MS = 3 * 60 * 60 * 1000;

/**
 * Poll the feed for the current match state and write the result.
 * If `forceFinish` is true and the snapshot is still not finished, the match
 * is written as finished with the polled score (ADR 0028).
 */
function pollMatch(
  match: Match,
  current: LiveResult,
  repo: LiveResultRepository,
  feed: LiveFeed,
  forceFinish: boolean,
): ResultAsync<void, Error> {
  return ResultAsync.fromPromise(feed.fetchSnapshot(match, current), (e) =>
    e instanceof Error
      ? e
      : new Error(`Failed to fetch snapshot for match ${match.num}: ${e}`),
  ).andThen((snapshotRes) => {
    if (snapshotRes.isErr()) {
      return errAsync<void, Error>(snapshotRes.error);
    }
    const snapshot = snapshotRes.value;
    const finished = snapshot.finished || forceFinish;
    return upsertLiveResult(repo, {
      num: match.num,
      status: finished ? "finished" : "live",
      goals1: snapshot.goals1,
      goals2: snapshot.goals2,
      penalties1: snapshot.penalties1,
      penalties2: snapshot.penalties2,
      allowCreate: true,
    })
      .mapErr(
        (e) =>
          new Error(
            `Failed to upsert live result for match ${match.num}: ${e.code}`,
          ),
      )
      .map(() => undefined);
  });
}

/**
 * Process a single match for this Tick.
 * Returns ok(true) if the feed was actually queried (counts toward processed),
 * ok(false) if the match was skipped (finished or not yet due).
 */
function processMatch(
  match: Match,
  repo: LiveResultRepository,
  feed: LiveFeed,
  forceFinish: boolean,
): ResultAsync<boolean, Error> {
  return ResultAsync.fromPromise(repo.findByNum(match.num), (e) =>
    e instanceof Error
      ? e
      : new Error(`Failed to find match ${match.num}: ${e}`),
  ).andThen((existing) => {
    // Finished latch: never re-poll a finished match
    if (existing !== null && existing.status === "finished") {
      return okAsync<boolean, Error>(false);
    }

    if (existing === null || existing.status === "upcoming") {
      return upsertLiveResult(repo, {
        num: match.num,
        status: "live",
        goals1: 0,
        goals2: 0,
        allowCreate: true,
      })
        .mapErr(
          (e) =>
            new Error(`Failed to auto-start match ${match.num}: ${e.code}`),
        )
        .andThen((startOutput) => {
          return pollMatch(
            match,
            startOutput.liveResult,
            repo,
            feed,
            forceFinish,
          ).map(() => true);
        });
    }

    // existing.status === "live"
    return pollMatch(match, existing, repo, feed, forceFinish).map(() => true);
  });
}

export function tickLiveFeed(
  repo: LiveResultRepository,
  feed: LiveFeed,
  clock: Clock,
): ResultAsync<TickSummary, never> {
  const matches = getAllMatches();
  const now = clock.now();

  const runSequential = async (): Promise<TickSummary> => {
    const errors: Error[] = [];
    let processed = 0;

    for (const match of matches) {
      const kickoffRes = getKickoffInstant(match);
      if (kickoffRes.isErr()) {
        errors.push(kickoffRes.error);
        continue;
      }

      const kickoff = kickoffRes.value;
      if (kickoff > now) {
        // Match hasn't kicked off yet — skip
        continue;
      }

      const elapsedMs = now.getTime() - kickoff.getTime();
      const forceFinish = elapsedMs >= FORCE_FINISH_MS;

      const res = await processMatch(match, repo, feed, forceFinish);
      if (res.isErr()) {
        errors.push(res.error);
      } else if (res.value) {
        // Only count matches for which the feed was actually queried
        processed++;
      }
    }

    return { processed, errors };
  };

  return ResultAsync.fromSafePromise(runSequential());
}
