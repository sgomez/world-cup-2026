import { describe, expect, it } from "vitest";
import { Community } from "../domain/community";
import { CommunityName } from "../domain/community-name";
import { CommunitySlug } from "../domain/community-slug";
import { InMemoryCommunityRepository } from "../infrastructure/in-memory-community-repository";
import { regenerateInviteToken } from "./regenerate-invite-token";

describe("regenerateInviteToken application service", () => {
  const name = CommunityName.create("The Office Sweepstake")._unsafeUnwrap();
  const slug = CommunitySlug.create("the-office-sweepstake")._unsafeUnwrap();
  const ownerId = "owner-123";
  const inviteToken = "token-abc";

  it("successfully regenerates token and saves if requested by owner", async () => {
    const repo = new InMemoryCommunityRepository();
    const community = Community.create(name, slug, ownerId, inviteToken);
    await repo.save(community);

    const command = {
      actorId: ownerId,
      slug: "the-office-sweepstake",
      newToken: "new-token-123",
    };

    const result = await regenerateInviteToken(repo, command);
    expect(result.isOk()).toBe(true);

    const updated = result._unsafeUnwrap();
    expect(updated.inviteToken).toBe("new-token-123");

    const saved = await repo.findById(community.id);
    expect(saved).not.toBeNull();
    expect(saved?.inviteToken).toBe("new-token-123");
  });

  it("fails if requested by a non-owner", async () => {
    const repo = new InMemoryCommunityRepository();
    const community = Community.create(name, slug, ownerId, inviteToken);
    await repo.save(community);

    const command = {
      actorId: "not-the-owner",
      slug: "the-office-sweepstake",
      newToken: "new-token-123",
    };

    const result = await regenerateInviteToken(repo, command);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("FORBIDDEN");

    const saved = await repo.findById(community.id);
    expect(saved).not.toBeNull();
    expect(saved?.inviteToken).toBe(inviteToken);
  });

  it("fails if community does not exist", async () => {
    const repo = new InMemoryCommunityRepository();
    const command = {
      actorId: ownerId,
      slug: "non-existent-slug",
      newToken: "new-token-123",
    };

    const result = await regenerateInviteToken(repo, command);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("NOT_FOUND");
  });
});
