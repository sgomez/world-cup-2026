import { errAsync, okAsync, ResultAsync } from "neverthrow";
import type { Community } from "../domain/community";
import type { CommunityRepository } from "../domain/community-repository";
import { type DomainError, domainError } from "../domain/errors";

export interface CommunityReadContext {
  readonly community: Community;
  readonly slug: string;
  readonly ownerId: string;
  readonly memberIds: string[];
  readonly imported: boolean;
  nameOf(userId: string): string;
}

export function viewerInCommunity(
  communityRepo: CommunityRepository,
  nameResolver: (userId: string) => Promise<string | null>,
  query: { communitySlug: string; viewerId: string },
): ResultAsync<CommunityReadContext, DomainError> {
  return ResultAsync.fromSafePromise(
    communityRepo.findBySlug(query.communitySlug),
  ).andThen((community) => {
    if (!community) {
      return errAsync<CommunityReadContext, DomainError>(
        domainError("NOT_FOUND"),
      );
    }

    const isViewerMember = community.memberIds.includes(query.viewerId);
    if (!isViewerMember) {
      return errAsync<CommunityReadContext, DomainError>(
        domainError("FORBIDDEN"),
      );
    }

    return ResultAsync.fromSafePromise(
      Promise.all(
        community.memberIds.map(async (userId) => {
          const name = await nameResolver(userId);
          return { userId, name: name ?? "Unknown" };
        }),
      ),
    ).andThen((userNamesList) => {
      const namesMap = new Map<string, string>();
      for (const { userId, name } of userNamesList) {
        namesMap.set(userId, name);
      }

      const context: CommunityReadContext = {
        community,
        slug: community.slug,
        ownerId: community.ownerId,
        memberIds: community.memberIds,
        imported: community.imported,
        nameOf(userId: string): string {
          return namesMap.get(userId) ?? "Unknown";
        },
      };

      return okAsync<CommunityReadContext, DomainError>(context);
    });
  });
}
