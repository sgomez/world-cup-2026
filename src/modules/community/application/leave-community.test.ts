import { describe, expect, it } from "vitest";
import { Community } from "../domain/community";
import { CommunityName } from "../domain/community-name";
import { CommunitySlug } from "../domain/community-slug";
import { InMemoryCommunityRepository } from "../infrastructure/in-memory-community-repository";
import { leaveCommunity } from "./leave-community";

describe("leaveCommunity application service", () => {
  const name = CommunityName.create("The Office Sweepstake")._unsafeUnwrap();
  const slug = CommunitySlug.create("the-office-sweepstake")._unsafeUnwrap();
  const ownerId = "owner-123";
  const inviteToken = "token-abc";

  it("successfully removes a non-owner member and saves it", async () => {
    const repo = new InMemoryCommunityRepository();
    const community = Community.create(name, slug, ownerId, inviteToken);
    const withMember = community.join("user-456")._unsafeUnwrap();
    await repo.save(withMember);

    const command = {
      userId: "user-456",
      slug: "the-office-sweepstake",
    };

    const result = await leaveCommunity(repo, command);
    expect(result.isOk()).toBe(true);

    const updated = result._unsafeUnwrap();
    expect(updated.memberIds).toEqual([ownerId]);

    // Verify it is saved in the repository
    const saved = await repo.findById(community.id);
    expect(saved).not.toBeNull();
    expect(saved?.memberIds).toEqual([ownerId]);
  });

  it("fails if the owner tries to leave", async () => {
    const repo = new InMemoryCommunityRepository();
    const community = Community.create(name, slug, ownerId, inviteToken);
    await repo.save(community);

    const command = {
      userId: ownerId,
      slug: "the-office-sweepstake",
    };

    const result = await leaveCommunity(repo, command);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("OWNER_CANNOT_LEAVE");
  });

  it("fails if a non-member tries to leave", async () => {
    const repo = new InMemoryCommunityRepository();
    const community = Community.create(name, slug, ownerId, inviteToken);
    await repo.save(community);

    const command = {
      userId: "stranger",
      slug: "the-office-sweepstake",
    };

    const result = await leaveCommunity(repo, command);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("NOT_A_MEMBER");
  });

  it("fails if the community slug is not found", async () => {
    const repo = new InMemoryCommunityRepository();
    const command = {
      userId: "user-456",
      slug: "non-existent-slug",
    };

    const result = await leaveCommunity(repo, command);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("NOT_FOUND");
  });
});
