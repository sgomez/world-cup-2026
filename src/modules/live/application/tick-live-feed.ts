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

function pollMatch(
  match: Match,
  current: LiveResult,
  repo: LiveResultRepository,
  feed: LiveFeed,
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
    return upsertLiveResult(repo, {
      num: match.num,
      status: snapshot.finished ? "finished" : "live",
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

function processMatch(
  match: Match,
  repo: LiveResultRepository,
  feed: LiveFeed,
): ResultAsync<void, Error> {
  return ResultAsync.fromPromise(repo.findByNum(match.num), (e) =>
    e instanceof Error
      ? e
      : new Error(`Failed to find match ${match.num}: ${e}`),
  ).andThen((existing) => {
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
          return pollMatch(match, startOutput.liveResult, repo, feed);
        });
    }

    if (existing.status === "live") {
      return pollMatch(match, existing, repo, feed);
    }

    return okAsync<void, Error>(undefined);
  });
}

export function tickLiveFeed(
  repo: LiveResultRepository,
  feed: LiveFeed,
  clock: Clock,
): ResultAsync<TickSummary, never> {
  const matches = getAllMatches();

  const runSequential = async (): Promise<TickSummary> => {
    const errors: Error[] = [];
    let processed = 0;

    for (const match of matches) {
      const kickoffRes = getKickoffInstant(match);
      if (kickoffRes.isErr()) {
        errors.push(kickoffRes.error);
        continue;
      }

      if (kickoffRes.value > clock.now()) {
        continue;
      }

      const res = await processMatch(match, repo, feed);
      if (res.isErr()) {
        errors.push(res.error);
      } else {
        processed++;
      }
    }

    return { processed, errors };
  };

  return ResultAsync.fromSafePromise(runSequential());
}
