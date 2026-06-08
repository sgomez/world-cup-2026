import { describe, expect, it } from "vitest";
import { Community } from "../domain/community";
import { CommunityName } from "../domain/community-name";
import { CommunitySlug } from "../domain/community-slug";
import { InMemoryCommunityRepository } from "../infrastructure/in-memory-community-repository";
import { removeMember } from "./remove-member";

describe("removeMember application service", () => {
  const name = CommunityName.create("The Office Sweepstake")._unsafeUnwrap();
  const slug = CommunitySlug.create("the-office-sweepstake")._unsafeUnwrap();
  const ownerId = "owner-123";
  const inviteToken = "token-abc";

  it("successfully allows the owner to remove a member and saves it", async () => {
    const repo = new InMemoryCommunityRepository();
    const community = Community.create(name, slug, ownerId, inviteToken);
    const withMember = community.join("user-456")._unsafeUnwrap();
    await repo.save(withMember);

    const command = {
      actorId: ownerId,
      targetUserId: "user-456",
      slug: "the-office-sweepstake",
    };

    const result = await removeMember(repo, command);
    expect(result.isOk()).toBe(true);

    const updated = result._unsafeUnwrap();
    expect(updated.memberIds).toEqual([ownerId]);

    // Verify it is saved in the repository
    const saved = await repo.findById(community.id);
    expect(saved).not.toBeNull();
    expect(saved?.memberIds).toEqual([ownerId]);
  });

  it("fails if a non-owner tries to remove a member", async () => {
    const repo = new InMemoryCommunityRepository();
    const community = Community.create(name, slug, ownerId, inviteToken);
    const withMember = community.join("user-456")._unsafeUnwrap();
    await repo.save(withMember);

    const command = {
      actorId: "user-456",
      targetUserId: "user-456",
      slug: "the-office-sweepstake",
    };

    const result = await removeMember(repo, command);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("FORBIDDEN");
  });

  it("fails if the owner tries to remove themselves", async () => {
    const repo = new InMemoryCommunityRepository();
    const community = Community.create(name, slug, ownerId, inviteToken);
    await repo.save(community);

    const command = {
      actorId: ownerId,
      targetUserId: ownerId,
      slug: "the-office-sweepstake",
    };

    const result = await removeMember(repo, command);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("FORBIDDEN");
  });

  it("fails if target user is not a member", async () => {
    const repo = new InMemoryCommunityRepository();
    const community = Community.create(name, slug, ownerId, inviteToken);
    await repo.save(community);

    const command = {
      actorId: ownerId,
      targetUserId: "stranger",
      slug: "the-office-sweepstake",
    };

    const result = await removeMember(repo, command);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("NOT_A_MEMBER");
  });

  it("fails if the community slug is not found", async () => {
    const repo = new InMemoryCommunityRepository();
    const command = {
      actorId: ownerId,
      targetUserId: "user-456",
      slug: "non-existent-slug",
    };

    const result = await removeMember(repo, command);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("NOT_FOUND");
  });
});
