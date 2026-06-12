import { errAsync, okAsync, ResultAsync } from "neverthrow";
import type { ScoreableContent } from "@/lib/scoring";
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
  return ResultAsync.fromSafePromise(
    communityRepo.findBySlug(query.communitySlug),
  ).andThen((community) => {
    if (!community) {
      return errAsync<PeerBetDTO, DomainError>(domainError("NOT_FOUND"));
    }

    const isViewerMember = community.memberIds.includes(query.viewerId);
    if (!isViewerMember) {
      return errAsync<PeerBetDTO, DomainError>(domainError("FORBIDDEN"));
    }

    return ResultAsync.fromSafePromise(betRepo.findById(query.betId)).andThen(
      (bet) => {
        if (!bet) {
          return errAsync<PeerBetDTO, DomainError>(domainError("NOT_FOUND"));
        }

        const isOwnerMember = community.memberIds.includes(bet.userId);
        if (!isOwnerMember) {
          return errAsync<PeerBetDTO, DomainError>(domainError("FORBIDDEN"));
        }

        const visibility = bet.peerVisibility(query.window, query.now);
        if (visibility === "hidden") {
          return errAsync<PeerBetDTO, DomainError>(domainError("FORBIDDEN"));
        }

        return ResultAsync.fromSafePromise(getUserName(bet.userId)).andThen(
          (ownerName) => {
            if (!ownerName) {
              return errAsync<PeerBetDTO, DomainError>(
                domainError("NOT_FOUND"),
              );
            }

            const isOwner = query.viewerId === community.ownerId;
            const serializedLabel = serializeLabel(
              bet.label,
              community.imported,
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
              communityName: community.name,
              visibility,
            });
          },
        );
      },
    );
  });
}
