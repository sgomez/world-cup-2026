import { okAsync, ResultAsync } from "neverthrow";
import { toScoreableContent } from "../../../lib/scoring";
import type { BetRepository } from "../../bet/domain/bet-repository";
import type { BettingWindow } from "../../bet/domain/betting-window";
import { viewerInCommunity } from "../../community/application/viewer-in-community";
import type { CommunityRepository } from "../../community/domain/community-repository";
import type { LiveResultRepository } from "../../live/domain/live-result-repository";
import { getActualScoreableContent } from "../../tournament/application/get-actual-scoreable-content";
import { Tournament } from "../../tournament/domain/tournament";
import type { TournamentRepository } from "../../tournament/domain/tournament-repository";
import { type DomainError, domainError } from "../domain/errors";
import { Leaderboard } from "../domain/leaderboard";

export type GetLeaderboardQuery = {
  viewerId: string;
  communitySlug: string;
  window: BettingWindow;
  now: Date;
};

export function getLeaderboard(
  communityRepo: CommunityRepository,
  betRepo: BetRepository,
  tournamentRepo: TournamentRepository,
  liveResultRepo: LiveResultRepository,
  getUserName: (userId: string) => Promise<string | null>,
  query: GetLeaderboardQuery,
): ResultAsync<Leaderboard, DomainError> {
  return viewerInCommunity(communityRepo, getUserName, {
    communitySlug: query.communitySlug,
    viewerId: query.viewerId,
  })
    .mapErr((err) =>
      domainError(err.code === "NOT_FOUND" ? "NOT_FOUND" : "FORBIDDEN"),
    )
    .andThen((context) => {
      return ResultAsync.fromSafePromise(
        Promise.all([
          betRepo.listByOwners(
            context.imported ? [context.ownerId] : context.memberIds,
          ),
          tournamentRepo.get(),
          liveResultRepo.findAll(),
        ]),
      ).andThen(([bets, tournament, liveResults]) => {
        const activeTournament = tournament ?? Tournament.createDefault();
        const actualResults = getActualScoreableContent(
          tournament,
          liveResults,
        );
        const isCompetitionEnded =
          activeTournament.isCompetitionEnded(liveResults);

        const betsWithOwners = bets.map((bet) => ({
          bet,
          ownerName: context.nameOf(bet.userId),
        }));

        const leaderboard = Leaderboard.create(
          betsWithOwners,
          toScoreableContent(actualResults),
          query.window,
          query.now,
          query.viewerId,
          isCompetitionEnded,
          context.imported,
        );

        return okAsync<Leaderboard, DomainError>(leaderboard);
      });
    });
}
