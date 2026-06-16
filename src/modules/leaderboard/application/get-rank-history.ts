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

        // Filter the returned data to include only the allowed bets:
        // - At most 10 bets in total
        // - If imported, top 10 bets.
        // - If native (own), best bet of each user sorted, keeping the top 10 (and ensuring viewer's best bet is included).
        const closedBets = bets.filter((bet) => bet.status === "closed");
        let allowedBets: typeof closedBets = [];

        if (context.imported) {
          // Sort all closed bets by final step rank, then points desc, then createdAt asc
          const sortedBets = [...closedBets].sort((a, b) => {
            const rankA = finalStep?.ranks[a.id]?.rank ?? 999999;
            const rankB = finalStep?.ranks[b.id]?.rank ?? 999999;
            if (rankA !== rankB) {
              return rankA - rankB;
            }
            const pointsA = finalStep?.ranks[a.id]?.points ?? 0;
            const pointsB = finalStep?.ranks[b.id]?.points ?? 0;
            if (pointsB !== pointsA) {
              return pointsB - pointsA;
            }
            return (
              (a.createdAt ?? new Date(0)).getTime() -
              (b.createdAt ?? new Date(0)).getTime()
            );
          });
          allowedBets = sortedBets.slice(0, 10);
        } else {
          // Group closedBets by userId
          const userBetsMap = new Map<string, typeof closedBets>();
          for (const bet of closedBets) {
            let list = userBetsMap.get(bet.userId);
            if (!list) {
              list = [];
              userBetsMap.set(bet.userId, list);
            }
            list.push(bet);
          }

          const bestUserBets: typeof closedBets = [];
          for (const list of userBetsMap.values()) {
            // Sort user's bets to find the best one
            list.sort((a, b) => {
              const rankA = finalStep?.ranks[a.id]?.rank ?? 999999;
              const rankB = finalStep?.ranks[b.id]?.rank ?? 999999;
              if (rankA !== rankB) {
                return rankA - rankB;
              }
              const pointsA = finalStep?.ranks[a.id]?.points ?? 0;
              const pointsB = finalStep?.ranks[b.id]?.points ?? 0;
              if (pointsB !== pointsA) {
                return pointsB - pointsA;
              }
              return (
                (a.createdAt ?? new Date(0)).getTime() -
                (b.createdAt ?? new Date(0)).getTime()
              );
            });
            bestUserBets.push(list[0]);
          }

          // Sort all best user bets by rank ascending (which is equivalent to points desc, createdAt asc)
          bestUserBets.sort((a, b) => {
            const rankA = finalStep?.ranks[a.id]?.rank ?? 999999;
            const rankB = finalStep?.ranks[b.id]?.rank ?? 999999;
            if (rankA !== rankB) {
              return rankA - rankB;
            }
            const pointsA = finalStep?.ranks[a.id]?.points ?? 0;
            const pointsB = finalStep?.ranks[b.id]?.points ?? 0;
            if (pointsB !== pointsA) {
              return pointsB - pointsA;
            }
            return (
              (a.createdAt ?? new Date(0)).getTime() -
              (b.createdAt ?? new Date(0)).getTime()
            );
          });

          // Ensure the viewer's best bet is always included (as the 10th item if not in the top 9)
          const viewerEntryIndex = query.viewerId
            ? bestUserBets.findIndex((b) => b.userId === query.viewerId)
            : -1;

          if (
            viewerEntryIndex === -1 ||
            viewerEntryIndex < 9 ||
            bestUserBets.length <= 10
          ) {
            allowedBets = bestUserBets.slice(0, 10);
          } else {
            allowedBets = [
              ...bestUserBets.slice(0, 9),
              bestUserBets[viewerEntryIndex],
            ];
          }
        }

        const allowedBetIds = new Set(allowedBets.map((b) => b.id));

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
