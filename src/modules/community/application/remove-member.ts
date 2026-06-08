import { errAsync, okAsync, ResultAsync } from "neverthrow";
import type { Community } from "../domain/community";
import type { CommunityRepository } from "../domain/community-repository";
import { type DomainError, domainError } from "../domain/errors";

export type RemoveMemberCommand = {
  actorId: string;
  targetUserId: string;
  slug: string;
};

export function removeMember(
  repo: CommunityRepository,
  command: RemoveMemberCommand,
): ResultAsync<Community, DomainError> {
  return ResultAsync.fromSafePromise(repo.findBySlug(command.slug))
    .andThen((community) => {
      if (!community) {
        return errAsync<Community, DomainError>(domainError("NOT_FOUND"));
      }

      const removeResult = community.removeMember(
        command.targetUserId,
        command.actorId,
      );
      if (removeResult.isErr()) {
        return errAsync<Community, DomainError>(removeResult.error);
      }

      return okAsync<Community, DomainError>(removeResult.value);
    })
    .andThen((updatedCommunity) =>
      repo.save(updatedCommunity).map(() => updatedCommunity),
    );
}
