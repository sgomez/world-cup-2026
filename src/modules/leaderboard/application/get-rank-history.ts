import { okAsync, ResultAsync } from "neverthrow";
import type { SerializedBetLabel } from "@/modules/bet/domain/bet-label";
import { serializeLabel } from "@/modules/bet/domain/bet-label";
import type { BetRepository } from "../../bet/domain/bet-repository";
import { viewerInCommunity } from "../../community/application/viewer-in-community";
import type { CommunityRepository } from "../../community/domain/community-repository";
import type { LiveResultRepository } from "../../live/domain/live-result-repository";
import type { TournamentRepository } from "../../tournament/domain/tournament-repository";
import { type DomainError, domainError } from "../domain/errors";
import {
  calculateRankHistory,
  type RankHistoryStep,
} from "../domain/rank-history";

export type GetRankHistoryQuery = {
  viewerId: string;
  communitySlug: string;
};

export interface RankHistoryResponse {
  bets: {
    id: string;
    userId: string;
    label: SerializedBetLabel;
  }[];
  steps: RankHistoryStep[];
}

export function getRankHistory(
  communityRepo: CommunityRepository,
  betRepo: BetRepository,
  tournamentRepo: TournamentRepository,
  liveResultRepo: LiveResultRepository,
  getUserName: (userId: string) => Promise<string | null>,
  query: GetRankHistoryQuery,
): ResultAsync<RankHistoryResponse, DomainError> {
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
        // Run simulation engine to calculate rank history for all closed bets
        const steps = calculateRankHistory(bets, liveResults, tournament);

        // Find the final step to identify the current top 10 rankings
        const finalStep = steps[steps.length - 1];

        // Filter the returned data to include only:
        // 1. The current user's Bets
        // 2. The current Top 10 Bets in that Community
        const top10BetIds = new Set<string>();
        if (finalStep) {
          for (const [betId, rankInfo] of Object.entries(finalStep.ranks)) {
            if (rankInfo.rank <= 10) {
              top10BetIds.add(betId);
            }
          }
        }

        const viewerBetIds = new Set(
          bets
            .filter((bet) => bet.userId === query.viewerId)
            .map((bet) => bet.id),
        );

        const allowedBetIds = new Set([...top10BetIds, ...viewerBetIds]);

        // Filter closed bets to only return allowed ones
        const closedBets = bets.filter((bet) => bet.status === "closed");
        const allowedBets = closedBets.filter((bet) =>
          allowedBetIds.has(bet.id),
        );

        // Format and apply Label Obfuscation rules
        // For imported communities, non-owner viewers must see obfuscated participant names (serializeLabel),
        // while the Import Owner sees full names.
        const formattedBets = allowedBets.map((bet) => {
          const isOwner =
            query.viewerId === bet.userId || query.viewerId === context.ownerId;
          const label = serializeLabel(bet.label, context.imported, isOwner);
          return {
            id: bet.id,
            userId: bet.userId,
            label,
          };
        });

        // Filter the ranks in each step to only include allowed bets
        const filteredSteps = steps.map((step) => {
          const filteredRanks: Record<
            string,
            { rank: number; points: number }
          > = {};
          for (const [betId, rankInfo] of Object.entries(step.ranks)) {
            if (allowedBetIds.has(betId)) {
              filteredRanks[betId] = rankInfo;
            }
          }
          return {
            ...step,
            ranks: filteredRanks,
          };
        });

        return okAsync<RankHistoryResponse, DomainError>({
          bets: formattedBets,
          steps: filteredSteps,
        });
      });
    });
}
