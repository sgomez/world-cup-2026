import { describe, expect, it } from "vitest";
import { User } from "../domain/user";
import { InMemoryUserRepository } from "../infrastructure/in-memory-user-repository";
import { promoteFirstRegistrant } from "./promote-first-registrant";

describe("promoteFirstRegistrant use-case", () => {
  const seedUser = User.create({
    id: "user-123",
    email: "test@example.com",
    name: "John Doe",
    emailVerified: true,
    image: null,
    role: "user",
  })._unsafeUnwrap();

  it("returns NOT_FOUND if the user does not exist", async () => {
    const repo = new InMemoryUserRepository();
    const result = await promoteFirstRegistrant(repo, {
      userId: "non-existent",
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("NOT_FOUND");
  });

  it("promotes the user to super_admin when no super_admin exists", async () => {
    const repo = new InMemoryUserRepository([seedUser]);
    const result = await promoteFirstRegistrant(repo, {
      userId: "user-123",
    });

    expect(result.isOk()).toBe(true);
    const updatedUser = result._unsafeUnwrap();
    expect(updatedUser.role).toBe("super_admin");

    // Verify it is saved in repository
    const userInRepo = await repo.findById("user-123");
    expect(userInRepo?.role).toBe("super_admin");
  });

  it("does not promote when a super_admin already exists", async () => {
    const superAdmin = User.create({
      id: "super-1",
      email: "super@example.com",
      name: "Super Admin",
      emailVerified: true,
      image: null,
      role: "super_admin",
    })._unsafeUnwrap();

    const repo = new InMemoryUserRepository([superAdmin, seedUser]);
    const result = await promoteFirstRegistrant(repo, {
      userId: "user-123",
    });

    expect(result.isOk()).toBe(true);
    const updatedUser = result._unsafeUnwrap();
    expect(updatedUser.role).toBe("user");

    // Verify it remains "user" in repository
    const userInRepo = await repo.findById("user-123");
    expect(userInRepo?.role).toBe("user");
  });

  it("promotes when other non-super_admin users (like Import Owner) exist, but no super_admin exists", async () => {
    const importOwner = User.create({
      id: "import-owner",
      email: "import@example.com",
      name: "Import Owner",
      emailVerified: true,
      image: null,
      role: "user",
    })._unsafeUnwrap();

    const repo = new InMemoryUserRepository([importOwner, seedUser]);
    const result = await promoteFirstRegistrant(repo, {
      userId: "user-123",
    });

    expect(result.isOk()).toBe(true);
    const updatedUser = result._unsafeUnwrap();
    expect(updatedUser.role).toBe("super_admin");

    // Verify it is saved in repository
    const userInRepo = await repo.findById("user-123");
    expect(userInRepo?.role).toBe("super_admin");
  });
});
