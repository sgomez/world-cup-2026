import { errAsync, ResultAsync } from "neverthrow";
import type { CommunityRepository } from "../domain/community-repository";
import { type DomainError, domainError } from "../domain/errors";

export type DeleteCommunityCommand = {
  actorId: string;
  slug: string;
};

export function deleteCommunity(
  repo: CommunityRepository,
  command: DeleteCommunityCommand,
): ResultAsync<void, DomainError> {
  return ResultAsync.fromSafePromise(repo.findBySlug(command.slug)).andThen(
    (community) => {
      if (!community) {
        return errAsync<void, DomainError>(domainError("NOT_FOUND"));
      }

      if (community.ownerId !== command.actorId) {
        return errAsync<void, DomainError>(domainError("FORBIDDEN"));
      }

      return repo.delete(community.id);
    },
  );
}
