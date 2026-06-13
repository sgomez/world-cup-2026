import { describe, expect, it } from "vitest";
import { User } from "../domain/user";
import { InMemoryUserRepository } from "../infrastructure/in-memory-user-repository";
import { changeRole } from "./change-role";

describe("changeRole use-case", () => {
  const seedUser = (id: string, role: string) =>
    User.create({
      id,
      email: `${id}@example.com`,
      name: `${id} Name`,
      emailVerified: true,
      image: `https://example.com/${id}.png`,
      role,
    })._unsafeUnwrap();

  it("returns FORBIDDEN if the actor does not exist", async () => {
    const target = seedUser("target-123", "user");
    const repo = new InMemoryUserRepository([target]);

    const result = await changeRole(repo, {
      actorId: "non-existent",
      targetUserId: "target-123",
      newRole: "admin",
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("FORBIDDEN");
  });

  it("returns NOT_FOUND if the target user does not exist", async () => {
    const actor = seedUser("actor-admin", "admin");
    const repo = new InMemoryUserRepository([actor]);

    const result = await changeRole(repo, {
      actorId: "actor-admin",
      targetUserId: "non-existent",
      newRole: "admin",
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("NOT_FOUND");
  });

  it("returns SUPER_ADMIN_IMMUTABLE if attempting to modify a super_admin user", async () => {
    const actor = seedUser("actor-super", "super_admin");
    const target = seedUser("target-super", "super_admin");
    const repo = new InMemoryUserRepository([actor, target]);

    const result = await changeRole(repo, {
      actorId: "actor-super",
      targetUserId: "target-super",
      newRole: "admin",
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("SUPER_ADMIN_IMMUTABLE");

    // verify repository was not changed
    const targetInRepo = await repo.findById("target-super");
    expect(targetInRepo?.role).toBe("super_admin");
  });

  it("returns SELF_DEMOTION_NOT_ALLOWED if actor tries to demote themselves", async () => {
    const actor = seedUser("actor-admin", "admin");
    const repo = new InMemoryUserRepository([actor]);

    const result = await changeRole(repo, {
      actorId: "actor-admin",
      targetUserId: "actor-admin",
      newRole: "user",
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("SELF_DEMOTION_NOT_ALLOWED");

    // verify repository was not changed
    const actorInRepo = await repo.findById("actor-admin");
    expect(actorInRepo?.role).toBe("admin");
  });

  it("returns FORBIDDEN if actor is a standard user", async () => {
    const actor = seedUser("actor-user", "user");
    const target = seedUser("target-user", "user");
    const repo = new InMemoryUserRepository([actor, target]);

    const result = await changeRole(repo, {
      actorId: "actor-user",
      targetUserId: "target-user",
      newRole: "admin",
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("FORBIDDEN");

    // verify repository was not changed
    const targetInRepo = await repo.findById("target-user");
    expect(targetInRepo?.role).toBe("user");
  });

  it("updates and saves the target user role successfully when actor is admin", async () => {
    const actor = seedUser("actor-admin", "admin");
    const target = seedUser("target-user", "user");
    const repo = new InMemoryUserRepository([actor, target]);

    const result = await changeRole(repo, {
      actorId: "actor-admin",
      targetUserId: "target-user",
      newRole: "admin",
    });

    expect(result.isOk()).toBe(true);
    const updatedUser = result._unsafeUnwrap();
    expect(updatedUser.role).toBe("admin");

    // verify repository was updated
    const targetInRepo = await repo.findById("target-user");
    expect(targetInRepo?.role).toBe("admin");
  });

  it("updates and saves the target user role successfully when actor is super_admin", async () => {
    const actor = seedUser("actor-super", "super_admin");
    const target = seedUser("target-user", "user");
    const repo = new InMemoryUserRepository([actor, target]);

    const result = await changeRole(repo, {
      actorId: "actor-super",
      targetUserId: "target-user",
      newRole: "admin",
    });

    expect(result.isOk()).toBe(true);
    const updatedUser = result._unsafeUnwrap();
    expect(updatedUser.role).toBe("admin");

    // verify repository was updated
    const targetInRepo = await repo.findById("target-user");
    expect(targetInRepo?.role).toBe("admin");
  });
});
