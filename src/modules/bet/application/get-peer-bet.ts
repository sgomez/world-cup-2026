import { errAsync, okAsync, ResultAsync } from "neverthrow";
import type { ScoreableContent } from "@/lib/scoring";
import { viewerInCommunity } from "../../community/application/viewer-in-community";
import type { CommunityRepository } from "../../community/domain/community-repository";
import type { BetStatus } from "../domain/bet";
import { type SerializedBetLabel, serializeLabel } from "../domain/bet-label";
import type { BetRepository } from "../domain/bet-repository";
import type { BettingWindow } from "../domain/betting-window";
import { type DomainError, domainError } from "../domain/errors";

export type GetPeerBetQuery = {
  viewerId: string;
  communitySlug: string;
  betId: string;
  window: BettingWindow;
  now: Date;
};

export type PeerBetDTO = {
  bet: {
    id: string;
    label: SerializedBetLabel;
    userId: string;
    status: BetStatus;
    createdAt?: Date;
    signature?: string;
    scoreableContent: () => ScoreableContent;
  };
  ownerName: string;
  communityName: string;
  visibility: "summary" | "full";
};

export function getPeerBet(
  betRepo: BetRepository,
  communityRepo: CommunityRepository,
  getUserName: (userId: string) => Promise<string | null>,
  query: GetPeerBetQuery,
): ResultAsync<PeerBetDTO, DomainError> {
  return viewerInCommunity(communityRepo, getUserName, {
    communitySlug: query.communitySlug,
    viewerId: query.viewerId,
  })
    .mapErr((err) =>
      domainError(err.code === "NOT_FOUND" ? "NOT_FOUND" : "FORBIDDEN"),
    )
    .andThen((context) => {
      return ResultAsync.fromSafePromise(betRepo.findById(query.betId)).andThen(
        (bet) => {
          if (!bet) {
            return errAsync<PeerBetDTO, DomainError>(domainError("NOT_FOUND"));
          }

          const isOwnerMember = context.memberIds.includes(bet.userId);
          if (!isOwnerMember) {
            return errAsync<PeerBetDTO, DomainError>(domainError("FORBIDDEN"));
          }

          if (context.imported && bet.userId !== context.ownerId) {
            return errAsync<PeerBetDTO, DomainError>(domainError("FORBIDDEN"));
          }

          const visibility = bet.peerVisibility(query.window, query.now);
          if (visibility === "hidden") {
            return errAsync<PeerBetDTO, DomainError>(domainError("FORBIDDEN"));
          }

          const ownerName = context.nameOf(bet.userId);
          const isOwner = query.viewerId === context.ownerId;
          const serializedLabel = serializeLabel(
            bet.label,
            context.imported,
            isOwner,
          );

          return okAsync<PeerBetDTO, DomainError>({
            bet: {
              id: bet.id,
              label: serializedLabel,
              userId: bet.userId,
              status: bet.status,
              createdAt: bet.createdAt,
              signature: bet.signature,
              scoreableContent: () => bet.scoreableContent(),
            },
            ownerName,
            communityName: context.community.name,
            visibility,
          });
        },
      );
    });
}
