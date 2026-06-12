import { errAsync, okAsync, ResultAsync } from "neverthrow";
import { toScoreableContent } from "../../../lib/scoring";
import type { BetRepository } from "../../bet/domain/bet-repository";
import type { BettingWindow } from "../../bet/domain/betting-window";
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
  return ResultAsync.fromSafePromise(
    communityRepo.findBySlug(query.communitySlug),
  ).andThen((community) => {
    if (!community) {
      return errAsync<Leaderboard, DomainError>(domainError("NOT_FOUND"));
    }

    const isViewerMember = community.memberIds.includes(query.viewerId);
    if (!isViewerMember) {
      return errAsync<Leaderboard, DomainError>(domainError("FORBIDDEN"));
    }

    return ResultAsync.fromSafePromise(
      Promise.all([
        betRepo.listByOwners(community.memberIds),
        tournamentRepo.get(),
        liveResultRepo.findAll(),
        Promise.all(
          community.memberIds.map(async (userId) => {
            const name = await getUserName(userId);
            return { userId, name: name ?? "Unknown" };
          }),
        ),
      ]),
    ).andThen(([bets, tournament, liveResults, userNamesList]) => {
      const activeTournament = tournament ?? Tournament.createDefault();
      const actualResults = getActualScoreableContent(tournament, liveResults);
      const isCompetitionEnded =
        activeTournament.isCompetitionEnded(liveResults);

      const userNamesMap = new Map<string, string>();
      for (const { userId, name } of userNamesList) {
        userNamesMap.set(userId, name);
      }

      const betsWithOwners = bets.map((bet) => ({
        bet,
        ownerName: userNamesMap.get(bet.userId) ?? "Unknown",
      }));

      const leaderboard = Leaderboard.create(
        betsWithOwners,
        toScoreableContent(actualResults),
        query.window,
        query.now,
        query.viewerId,
        isCompetitionEnded,
        community.imported,
      );

      return okAsync<Leaderboard, DomainError>(leaderboard);
    });
  });
}
