import { describe, expect, it } from "vitest";
import { User } from "../domain/user";
import { InMemoryUserRepository } from "../infrastructure/in-memory-user-repository";
import { updateProfile } from "./update-profile";

describe("updateProfile use-case", () => {
  const seedUser = User.create({
    id: "user-123",
    email: "test@example.com",
    name: "John Doe",
    emailVerified: true,
    image: "https://example.com/avatar.png",
  })._unsafeUnwrap();

  it("returns NOT_FOUND if the user does not exist", async () => {
    const repo = new InMemoryUserRepository();
    const result = await updateProfile(repo, {
      userId: "non-existent",
      name: "Jane Doe",
      image: "https://example.com/new.png",
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("NOT_FOUND");
  });

  it("returns validation error (NAME_REQUIRED) if the name is invalid", async () => {
    const repo = new InMemoryUserRepository([seedUser]);
    const result = await updateProfile(repo, {
      userId: "user-123",
      name: "   ",
      image: "https://example.com/new.png",
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("NAME_REQUIRED");

    // verify repository was not changed
    const userInRepo = await repo.findById("user-123");
    expect(userInRepo?.name).toBe("John Doe");
  });

  it("updates and saves the user profile details successfully", async () => {
    const repo = new InMemoryUserRepository([seedUser]);
    const result = await updateProfile(repo, {
      userId: "user-123",
      name: "Jane Doe",
      image: "https://example.com/new-avatar.png",
    });

    expect(result.isOk()).toBe(true);
    const updatedUser = result._unsafeUnwrap();
    expect(updatedUser.name).toBe("Jane Doe");
    expect(updatedUser.image).toBe("https://example.com/new-avatar.png");

    // verify repository was updated
    const userInRepo = await repo.findById("user-123");
    expect(userInRepo?.name).toBe("Jane Doe");
    expect(userInRepo?.image).toBe("https://example.com/new-avatar.png");
  });
});
