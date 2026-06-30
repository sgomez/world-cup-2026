import { errAsync, okAsync, ResultAsync } from "neverthrow";
import {
  getAllMatches,
  getKickoffInstant,
  type Match,
  slotForNum,
} from "@/modules/schedule";
import { getTeamById } from "@/modules/teams";
import { buildBracketView } from "@/modules/tournament/domain/derive-result";
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
 * Builds a lookup from match-number + side to a human-readable team name.
 *
 * Group-stage matches already carry display names in `worldcup.json`
 * ("Germany", "Mexico").  Knockout matches carry placeholder codes ("1E",
 * "3A/B/C/D/F", "W73") that are resolved here via the tournament bracket
 * engine against the current live results.
 */
async function buildTeamNameLookup(
  repo: LiveResultRepository,
): Promise<Map<string, string>> {
  const lookup = new Map<string, string>();

  try {
    const allLiveResults = await repo.findAll();
    const bracketView = buildBracketView(
      allLiveResults,
      {} /* manualTieBreaks — cron has no access to admin overrides */,
      null /* thirdPlaceManualOrder */,
    );

    for (const [slotId, km] of Object.entries(bracketView)) {
      if (km.team1Id) {
        const team = getTeamById(km.team1Id, "en");
        if (team) lookup.set(`${slotId}:1`, team.name);
      }
      if (km.team2Id) {
        const team = getTeamById(km.team2Id, "en");
        if (team) lookup.set(`${slotId}:2`, team.name);
      }
    }
  } catch (e) {
    console.error(
      "[LiveFeedPoller] Failed to resolve knockout team names, falling back to raw identifiers",
      e,
    );
  }

  return lookup;
}

function resolveTeamName(
  raw: string,
  matchNum: number,
  side: 1 | 2,
  lookup: Map<string, string>,
): string {
  const slotId = slotForNum(matchNum);
  if (!slotId) return raw;
  return lookup.get(`${slotId}:${side}`) ?? raw;
}

function pollMatch(
  match: Match,
  current: LiveResult,
  repo: LiveResultRepository,
  feed: LiveFeed,
  teamNameLookup: Map<string, string>,
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
      .map(() => {
        const team1Name = resolveTeamName(
          match.team1,
          match.num,
          1,
          teamNameLookup,
        );
        const team2Name = resolveTeamName(
          match.team2,
          match.num,
          2,
          teamNameLookup,
        );
        const score =
          snapshot.penalties1 !== undefined && snapshot.penalties2 !== undefined
            ? `${snapshot.goals1} (${snapshot.penalties1}) - ${snapshot.goals2} (${snapshot.penalties2})`
            : `${snapshot.goals1} - ${snapshot.goals2}`;
        const state = snapshot.finished ? "Finished" : "Live";
        console.log(
          `[LiveFeedPoller] Match: ${team1Name} vs ${team2Name}. Score: ${score}. State: ${state}`,
        );
        return undefined;
      });
  });
}

/**
 * Processes a single match for a Tick.
 *
 * Resolves to `true` when the Feed was actually polled this cycle
 * (auto-started-then-polled, or already-`live`-then-polled, including a
 * match the Feed reports `finished` in the same cycle), and `false` when
 * the match was skipped (already `finished` from a prior cycle). A poll
 * error rejects with the error and is recorded in the Tick's `errors`.
 */
function processMatch(
  match: Match,
  repo: LiveResultRepository,
  feed: LiveFeed,
  teamNameLookup: Map<string, string>,
): ResultAsync<boolean, Error> {
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
        .andThen((startOutput) =>
          pollMatch(match, startOutput.liveResult, repo, feed, teamNameLookup),
        )
        .map(() => true);
    }

    if (existing.status === "live") {
      return pollMatch(match, existing, repo, feed, teamNameLookup).map(
        () => true,
      );
    }

    return okAsync<boolean, Error>(false);
  });
}

export function tickLiveFeed(
  repo: LiveResultRepository,
  feed: LiveFeed,
  clock: Clock,
): ResultAsync<TickSummary, never> {
  const matches = getAllMatches();

  const runSequential = async (): Promise<TickSummary> => {
    const teamNameLookup = await buildTeamNameLookup(repo);

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

      const res = await processMatch(match, repo, feed, teamNameLookup);
      if (res.isErr()) {
        errors.push(res.error);
      } else if (res.value) {
        processed++;
      }
    }

    return { processed, errors };
  };

  return ResultAsync.fromSafePromise(runSequential());
}
