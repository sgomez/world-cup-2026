import { describe, expect, it } from "vitest";
import { Community } from "../domain/community";
import { CommunityName } from "../domain/community-name";
import { CommunitySlug } from "../domain/community-slug";
import { InMemoryCommunityRepository } from "../infrastructure/in-memory-community-repository";
import { joinCommunity } from "./join-community";

describe("joinCommunity application service", () => {
  const name = CommunityName.create("The Office Sweepstake")._unsafeUnwrap();
  const slug = CommunitySlug.create("the-office-sweepstake")._unsafeUnwrap();
  const ownerId = "owner-123";
  const inviteToken = "token-abc";

  it("successfully adds a new member to an existing community and saves it", async () => {
    const repo = new InMemoryCommunityRepository();
    const community = Community.create(name, slug, ownerId, inviteToken);
    await repo.save(community);

    const command = {
      userId: "user-456",
      inviteToken: "token-abc",
    };

    const result = await joinCommunity(repo, command);
    expect(result.isOk()).toBe(true);

    const updated = result._unsafeUnwrap();
    expect(updated.memberIds).toEqual([ownerId, "user-456"]);

    // Verify it is saved in the repository
    const saved = await repo.findById(community.id);
    expect(saved).not.toBeNull();
    expect(saved?.memberIds).toEqual([ownerId, "user-456"]);
  });

  it("is idempotent when adding an existing member", async () => {
    const repo = new InMemoryCommunityRepository();
    const community = Community.create(name, slug, ownerId, inviteToken);
    const withMember = community.join("user-456")._unsafeUnwrap();
    await repo.save(withMember);

    const command = {
      userId: "user-456",
      inviteToken: "token-abc",
    };

    const result = await joinCommunity(repo, command);
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().memberIds).toEqual([ownerId, "user-456"]);
  });

  it("fails if the invite token is not found", async () => {
    const repo = new InMemoryCommunityRepository();
    const command = {
      userId: "user-456",
      inviteToken: "non-existent-token",
    };

    const result = await joinCommunity(repo, command);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("NOT_FOUND");
  });
});
