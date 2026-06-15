import { errAsync, okAsync, ResultAsync } from "neverthrow";
import { toScoreableContent } from "@/modules/score";
import type { BetRepository } from "../../bet/domain/bet-repository";
import type { BettingWindow } from "../../bet/domain/betting-window";
import type { CommunityRepository } from "../../community/domain/community-repository";
import type { LiveResultRepository } from "../../live/domain/live-result-repository";
import { getActualScoreableContent } from "../../tournament/application/get-actual-scoreable-content";
import { Tournament } from "../../tournament/domain/tournament";
import type { TournamentRepository } from "../../tournament/domain/tournament-repository";
import { type DomainError, domainError } from "../domain/errors";
import { Leaderboard } from "../domain/leaderboard";

export type ShareCardEntry = {
  label: string;
  points: number;
  rank: number;
};

export type ShareCardData = {
  communityName: string;
  totalBets: number;
  entries: ShareCardEntry[];
};

export type GetShareCardQuery = {
  communitySlug: string;
  window: BettingWindow;
  now: Date;
};

/**
 * Assembles share-card data for a native Community's OG image.
 * Returns NOT_FOUND for imported or non-existent communities.
 * Payload carries Bet labels, scores, and ranks — never owner names.
 */
export function getShareCard(
  communityRepo: CommunityRepository,
  betRepo: BetRepository,
  tournamentRepo: TournamentRepository,
  liveResultRepo: LiveResultRepository,
  query: GetShareCardQuery,
): ResultAsync<ShareCardData, DomainError> {
  return ResultAsync.fromSafePromise(
    communityRepo.findBySlug(query.communitySlug),
  ).andThen((community) => {
    if (!community) {
      return errAsync<ShareCardData, DomainError>(domainError("NOT_FOUND"));
    }
    if (community.imported) {
      return errAsync<ShareCardData, DomainError>(domainError("NOT_FOUND"));
    }

    return ResultAsync.fromSafePromise(
      Promise.all([
        betRepo.listByOwners(community.memberIds),
        tournamentRepo.get(),
        liveResultRepo.findAll(),
      ]),
    ).andThen(([bets, tournament, liveResults]) => {
      const activeTournament = tournament ?? Tournament.createDefault();
      const actualResults = getActualScoreableContent(tournament, liveResults);
      const isCompetitionEnded =
        activeTournament.isCompetitionEnded(liveResults);

      // Build leaderboard with null viewerId — post-deadline all bets visible.
      // Owner names are provided as empty strings since the card never renders them.
      const betsWithOwners = bets.map((bet) => ({
        bet,
        ownerName: "",
      }));

      const leaderboard = Leaderboard.create(
        betsWithOwners,
        toScoreableContent(actualResults),
        query.window,
        query.now,
        null, // No authenticated viewer — treat as public read
        isCompetitionEnded,
        false, // community is native (imported checked above)
      );

      const entries: ShareCardEntry[] = leaderboard.entries.map((e) => {
        const label = e.betName.obfuscated === false ? e.betName.value : "";
        return {
          label,
          points: e.points,
          rank: e.rank,
        };
      });

      const card: ShareCardData = {
        communityName: community.name,
        totalBets: leaderboard.entries.length,
        entries,
      };

      return okAsync<ShareCardData, DomainError>(card);
    });
  });
}
