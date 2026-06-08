import { errAsync, okAsync, ResultAsync } from "neverthrow";
import type { CommunityRepository } from "../../community/domain/community-repository";
import type { Bet } from "../domain/bet";
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
  bet: Bet;
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
            return okAsync<PeerBetDTO, DomainError>({
              bet,
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
