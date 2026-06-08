import { errAsync, okAsync, ResultAsync } from "neverthrow";
import type { Community } from "../domain/community";
import type { CommunityRepository } from "../domain/community-repository";
import { type DomainError, domainError } from "../domain/errors";

export type LeaveCommunityCommand = {
  userId: string;
  slug: string;
};

export function leaveCommunity(
  repo: CommunityRepository,
  command: LeaveCommunityCommand,
): ResultAsync<Community, DomainError> {
  return ResultAsync.fromSafePromise(repo.findBySlug(command.slug))
    .andThen((community) => {
      if (!community) {
        return errAsync<Community, DomainError>(domainError("NOT_FOUND"));
      }

      const leaveResult = community.leave(command.userId);
      if (leaveResult.isErr()) {
        return errAsync<Community, DomainError>(leaveResult.error);
      }

      return okAsync<Community, DomainError>(leaveResult.value);
    })
    .andThen((updatedCommunity) =>
      repo.save(updatedCommunity).map(() => updatedCommunity),
    );
}
