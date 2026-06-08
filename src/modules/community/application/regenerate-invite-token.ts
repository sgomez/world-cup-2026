import { errAsync, okAsync, ResultAsync } from "neverthrow";
import type { Community } from "../domain/community";
import type { CommunityRepository } from "../domain/community-repository";
import { type DomainError, domainError } from "../domain/errors";

export type RegenerateInviteTokenCommand = {
  actorId: string;
  slug: string;
  newToken: string;
};

export function regenerateInviteToken(
  repo: CommunityRepository,
  command: RegenerateInviteTokenCommand,
): ResultAsync<Community, DomainError> {
  return ResultAsync.fromSafePromise(repo.findBySlug(command.slug))
    .andThen((community) => {
      if (!community) {
        return errAsync<Community, DomainError>(domainError("NOT_FOUND"));
      }

      const regenerateResult = community.regenerateInviteToken(
        command.actorId,
        command.newToken,
      );
      if (regenerateResult.isErr()) {
        return errAsync<Community, DomainError>(regenerateResult.error);
      }

      return okAsync<Community, DomainError>(regenerateResult.value);
    })
    .andThen((updatedCommunity) =>
      repo.save(updatedCommunity).map(() => updatedCommunity),
    );
}
