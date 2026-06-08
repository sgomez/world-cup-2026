import { describe, expect, it } from "vitest";
import { Community } from "../domain/community";
import { CommunityName } from "../domain/community-name";
import { CommunitySlug } from "../domain/community-slug";
import { InMemoryCommunityRepository } from "../infrastructure/in-memory-community-repository";
import { createCommunity } from "./create-community";

describe("createCommunity application service", () => {
  it("successfully creates a community with a unique slug and saves it", async () => {
    const repo = new InMemoryCommunityRepository();
    const command = {
      ownerId: "owner-1",
      name: "Cool Group",
      inviteToken: "token-1",
    };

    const result = await createCommunity(repo, command);
    expect(result.isOk()).toBe(true);

    const community = result._unsafeUnwrap();
    expect(community.name).toBe("Cool Group");
    expect(community.slug).toBe("cool-group");
    expect(community.ownerId).toBe("owner-1");
    expect(community.inviteToken).toBe("token-1");
    expect(community.memberIds).toEqual(["owner-1"]);

    // Verify it is saved in the repository
    const saved = await repo.findById(community.id);
    expect(saved).not.toBeNull();
    expect(saved?.slug).toBe("cool-group");
  });

  it("resolves slug duplicate by appending counter", async () => {
    const repo = new InMemoryCommunityRepository();
    // Seed an existing community with slug "cool-group"
    const existingName = CommunityName.create("Cool Group")._unsafeUnwrap();
    const existingSlug = CommunitySlug.create("cool-group")._unsafeUnwrap();
    const existing = Community.create(
      existingName,
      existingSlug,
      "owner-2",
      "token-2",
    );
    await repo.save(existing);

    const command = {
      ownerId: "owner-1",
      name: "Cool Group",
      inviteToken: "token-1",
    };

    const result = await createCommunity(repo, command);
    expect(result.isOk()).toBe(true);

    const community = result._unsafeUnwrap();
    expect(community.slug).toBe("cool-group-2");

    // Seed another one to verify it increments
    const existing2 = Community.create(
      existingName,
      CommunitySlug.create("cool-group-2")._unsafeUnwrap(),
      "owner-3",
      "token-3",
    );
    await repo.save(existing2);

    const result3 = await createCommunity(repo, command);
    expect(result3.isOk()).toBe(true);
    expect(result3._unsafeUnwrap().slug).toBe("cool-group-3");
  });

  it("fails if community name is invalid", async () => {
    const repo = new InMemoryCommunityRepository();
    const command = {
      ownerId: "owner-1",
      name: "   ",
      inviteToken: "token-1",
    };

    const result = await createCommunity(repo, command);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("INVALID_NAME");
  });
});
