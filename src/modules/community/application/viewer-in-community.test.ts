import { describe, expect, it } from "vitest";
import { Community } from "../domain/community";
import { CommunityName } from "../domain/community-name";
import { CommunitySlug } from "../domain/community-slug";
import { InMemoryCommunityRepository } from "../infrastructure/in-memory-community-repository";
import { viewerInCommunity } from "./viewer-in-community";

describe("viewerInCommunity resolver", () => {
  const name = CommunityName.create("Champs")._unsafeUnwrap();
  const slug = CommunitySlug.create("champs")._unsafeUnwrap();
  const ownerId = "owner-123";
  const inviteToken = "token-abc";

  const mockNameResolver = async (userId: string) => {
    if (userId === "owner-123") return "Alice";
    if (userId === "member-456") return "Bob";
    return null;
  };

  it("fails with NOT_FOUND if the community does not exist", async () => {
    const repo = new InMemoryCommunityRepository();
    const result = await viewerInCommunity(repo, mockNameResolver, {
      communitySlug: "non-existent",
      viewerId: "owner-123",
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("NOT_FOUND");
  });

  it("fails with FORBIDDEN if the viewer is not a member of the community", async () => {
    const repo = new InMemoryCommunityRepository();
    const community = Community.create(name, slug, ownerId, inviteToken);
    await repo.save(community);

    const result = await viewerInCommunity(repo, mockNameResolver, {
      communitySlug: "champs",
      viewerId: "outsider-789",
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("FORBIDDEN");
  });

  it("succeeds for community members, providing a context with community fields and resolved names", async () => {
    const repo = new InMemoryCommunityRepository();
    const community = Community.fromState({
      id: "comm-1",
      name: "Champs",
      slug: "champs",
      ownerId: "owner-123",
      inviteToken: "token-abc",
      memberIds: ["owner-123", "member-456"],
      imported: false,
    });
    await repo.save(community);

    const result = await viewerInCommunity(repo, mockNameResolver, {
      communitySlug: "champs",
      viewerId: "member-456",
    });

    expect(result.isOk()).toBe(true);
    const context = result._unsafeUnwrap();

    expect(context.slug).toBe("champs");
    expect(context.ownerId).toBe("owner-123");
    expect(context.memberIds).toEqual(["owner-123", "member-456"]);
    expect(context.imported).toBe(false);

    expect(context.nameOf("owner-123")).toBe("Alice");
    expect(context.nameOf("member-456")).toBe("Bob");
    expect(context.nameOf("unknown-999")).toBe("Unknown");
  });

  it("correctly identifies imported community scoping", async () => {
    const repo = new InMemoryCommunityRepository();
    const community = Community.fromState({
      id: "comm-1",
      name: "Champs",
      slug: "champs",
      ownerId: "owner-123",
      inviteToken: "token-abc",
      memberIds: ["owner-123", "member-456"],
      imported: true,
    });
    await repo.save(community);

    const result = await viewerInCommunity(repo, mockNameResolver, {
      communitySlug: "champs",
      viewerId: "owner-123",
    });

    expect(result.isOk()).toBe(true);
    const context = result._unsafeUnwrap();
    expect(context.imported).toBe(true);
  });
});
