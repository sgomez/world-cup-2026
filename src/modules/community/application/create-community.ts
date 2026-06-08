import { errAsync, okAsync, ResultAsync } from "neverthrow";
import { Community } from "../domain/community";
import { CommunityName } from "../domain/community-name";
import type { CommunityRepository } from "../domain/community-repository";
import { CommunitySlug } from "../domain/community-slug";
import type { DomainError } from "../domain/errors";

export type CreateCommunityCommand = {
  ownerId: string;
  name: string;
  inviteToken: string;
};

export function createCommunity(
  repo: CommunityRepository,
  command: CreateCommunityCommand,
): ResultAsync<Community, DomainError> {
  const nameResult = CommunityName.create(command.name);
  if (nameResult.isErr()) {
    return errAsync(nameResult.error);
  }
  const name = nameResult.value;

  const slugResult = CommunitySlug.derive(name.value);
  if (slugResult.isErr()) {
    return errAsync(slugResult.error);
  }
  const slugBase = slugResult.value.value;

  const findUniqueSlug = async (base: string): Promise<string> => {
    const existing = await repo.findBySlug(base);
    if (!existing) return base;

    let counter = 2;
    while (true) {
      const candidate = `${base}-${counter}`;
      const taken = await repo.findBySlug(candidate);
      if (!taken) return candidate;
      counter++;
    }
  };

  return ResultAsync.fromSafePromise(findUniqueSlug(slugBase))
    .andThen((uniqueSlugStr) => {
      const slugVoResult = CommunitySlug.create(uniqueSlugStr);
      if (slugVoResult.isErr()) {
        return errAsync<Community, DomainError>(slugVoResult.error);
      }
      const slugVo = slugVoResult.value;

      const community = Community.create(
        name,
        slugVo,
        command.ownerId,
        command.inviteToken,
      );

      return okAsync<Community, DomainError>(community);
    })
    .andThen((community) => repo.save(community).map(() => community));
}
