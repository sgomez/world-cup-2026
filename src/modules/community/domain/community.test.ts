import { describe, expect, it } from "vitest";
import { Community } from "./community";
import { CommunityName } from "./community-name";
import { CommunitySlug } from "./community-slug";

describe("Community Aggregate Root", () => {
  const name = CommunityName.create("The Office Sweepstake")._unsafeUnwrap();
  const slug = CommunitySlug.create("the-office-sweepstake")._unsafeUnwrap();
  const ownerId = "owner-123";
  const inviteToken = "token-abc";

  it("creates a community with the owner as the first member", () => {
    const community = Community.create(name, slug, ownerId, inviteToken);
    expect(community.id).toBeDefined();
    expect(community.name).toBe("The Office Sweepstake");
    expect(community.slug).toBe("the-office-sweepstake");
    expect(community.ownerId).toBe(ownerId);
    expect(community.inviteToken).toBe(inviteToken);
    expect(community.memberIds).toEqual([ownerId]);
    expect(community.imported).toBe(false);
  });

  it("creates an imported community with the imported flag set to true", () => {
    const community = Community.createImported(
      name,
      slug,
      ownerId,
      inviteToken,
    );
    expect(community.id).toBeDefined();
    expect(community.name).toBe("The Office Sweepstake");
    expect(community.slug).toBe("the-office-sweepstake");
    expect(community.ownerId).toBe(ownerId);
    expect(community.inviteToken).toBe(inviteToken);
    expect(community.memberIds).toEqual([ownerId]);
    expect(community.imported).toBe(true);
  });

  describe("join", () => {
    it("adds a new member to the community", () => {
      const community = Community.create(name, slug, ownerId, inviteToken);
      const joined = community.join("user-456")._unsafeUnwrap();
      expect(joined.memberIds).toEqual([ownerId, "user-456"]);
    });

    it("is idempotent when adding an existing member", () => {
      const community = Community.create(name, slug, ownerId, inviteToken);
      const joinedOnce = community.join("user-456")._unsafeUnwrap();
      const joinedTwice = joinedOnce.join("user-456")._unsafeUnwrap();
      expect(joinedTwice.memberIds).toEqual([ownerId, "user-456"]);
    });
  });

  describe("leave", () => {
    it("allows a non-owner member to leave", () => {
      const community = Community.create(name, slug, ownerId, inviteToken);
      const withMember = community.join("user-456")._unsafeUnwrap();
      const left = withMember.leave("user-456")._unsafeUnwrap();
      expect(left.memberIds).toEqual([ownerId]);
    });

    it("prevents the owner from leaving", () => {
      const community = Community.create(name, slug, ownerId, inviteToken);
      const result = community.leave(ownerId);
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe("OWNER_CANNOT_LEAVE");
    });

    it("fails if user is not a member", () => {
      const community = Community.create(name, slug, ownerId, inviteToken);
      const result = community.leave("stranger");
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe("NOT_A_MEMBER");
    });
  });

  describe("removeMember", () => {
    it("allows the owner to remove a member", () => {
      const community = Community.create(name, slug, ownerId, inviteToken);
      const withMember = community.join("user-456")._unsafeUnwrap();
      const removed = withMember
        .removeMember("user-456", ownerId)
        ._unsafeUnwrap();
      expect(removed.memberIds).toEqual([ownerId]);
    });

    it("prevents non-owners from removing members", () => {
      const community = Community.create(name, slug, ownerId, inviteToken);
      const withMember = community.join("user-456")._unsafeUnwrap();
      const result = withMember.removeMember("user-456", "user-456");
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe("FORBIDDEN");
    });

    it("prevents owner from removing themselves", () => {
      const community = Community.create(name, slug, ownerId, inviteToken);
      const result = community.removeMember(ownerId, ownerId);
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe("FORBIDDEN");
    });

    it("fails if target user is not a member", () => {
      const community = Community.create(name, slug, ownerId, inviteToken);
      const result = community.removeMember("stranger", ownerId);
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe("NOT_A_MEMBER");
    });
  });

  describe("regenerateInviteToken", () => {
    it("allows the owner to regenerate invite token", () => {
      const community = Community.create(name, slug, ownerId, inviteToken);
      const regenerated = community
        .regenerateInviteToken(ownerId, "new-token-123")
        ._unsafeUnwrap();
      expect(regenerated.inviteToken).toBe("new-token-123");
    });

    it("prevents non-owners from regenerating invite token", () => {
      const community = Community.create(name, slug, ownerId, inviteToken);
      const result = community.regenerateInviteToken(
        "stranger",
        "new-token-123",
      );
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe("FORBIDDEN");
    });
  });
});
