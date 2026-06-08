import { errAsync, okAsync, ResultAsync } from "neverthrow";
import type { Community } from "../domain/community";
import type { CommunityRepository } from "../domain/community-repository";
import { type DomainError, domainError } from "../domain/errors";

export type JoinCommunityCommand = {
  userId: string;
  inviteToken: string;
};

export function joinCommunity(
  repo: CommunityRepository,
  command: JoinCommunityCommand,
): ResultAsync<Community, DomainError> {
  return ResultAsync.fromSafePromise(
    repo.findByInviteToken(command.inviteToken),
  )
    .andThen((community) => {
      if (!community) {
        return errAsync<Community, DomainError>(domainError("NOT_FOUND"));
      }

      const joinResult = community.join(command.userId);
      if (joinResult.isErr()) {
        return errAsync<Community, DomainError>(joinResult.error);
      }

      return okAsync<Community, DomainError>(joinResult.value);
    })
    .andThen((updatedCommunity) =>
      repo.save(updatedCommunity).map(() => updatedCommunity),
    );
}
