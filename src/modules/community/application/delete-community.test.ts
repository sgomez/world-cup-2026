import { describe, expect, it } from "vitest";
import { Community } from "../domain/community";
import { CommunityName } from "../domain/community-name";
import { CommunitySlug } from "../domain/community-slug";
import { InMemoryCommunityRepository } from "../infrastructure/in-memory-community-repository";
import { deleteCommunity } from "./delete-community";

describe("deleteCommunity application service", () => {
  const name = CommunityName.create("The Office Sweepstake")._unsafeUnwrap();
  const slug = CommunitySlug.create("the-office-sweepstake")._unsafeUnwrap();
  const ownerId = "owner-123";
  const inviteToken = "token-abc";

  it("successfully deletes the community if requested by the owner", async () => {
    const repo = new InMemoryCommunityRepository();
    const community = Community.create(name, slug, ownerId, inviteToken);
    await repo.save(community);

    const command = {
      actorId: ownerId,
      slug: "the-office-sweepstake",
    };

    const result = await deleteCommunity(repo, command);
    expect(result.isOk()).toBe(true);

    const saved = await repo.findById(community.id);
    expect(saved).toBeNull();
  });

  it("fails if requested by a non-owner", async () => {
    const repo = new InMemoryCommunityRepository();
    const community = Community.create(name, slug, ownerId, inviteToken);
    await repo.save(community);

    const command = {
      actorId: "not-the-owner",
      slug: "the-office-sweepstake",
    };

    const result = await deleteCommunity(repo, command);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("FORBIDDEN");

    const saved = await repo.findById(community.id);
    expect(saved).not.toBeNull();
  });

  it("fails if community does not exist", async () => {
    const repo = new InMemoryCommunityRepository();
    const command = {
      actorId: ownerId,
      slug: "non-existent-slug",
    };

    const result = await deleteCommunity(repo, command);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("NOT_FOUND");
  });
});
