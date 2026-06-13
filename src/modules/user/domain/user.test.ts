import { describe, expect, it } from "vitest";
import { User } from "./user";

describe("User Aggregate Root", () => {
  const validUserParams = {
    id: "user-123",
    email: "test@example.com",
    name: "John Doe",
    emailVerified: true,
    image: "https://example.com/avatar.png",
    role: "user",
  };

  it("can be created with valid state", () => {
    const user = User.create(validUserParams)._unsafeUnwrap();
    expect(user.id).toBe("user-123");
    expect(user.email).toBe("test@example.com");
    expect(user.name).toBe("John Doe");
    expect(user.emailVerified).toBe(true);
    expect(user.image).toBe("https://example.com/avatar.png");
    expect(user.role).toBe("user");
    expect(user.banned).toBe(false);
  });

  it("trims the name during creation", () => {
    const user = User.create({
      ...validUserParams,
      name: "  Jane Doe  ",
    })._unsafeUnwrap();
    expect(user.name).toBe("Jane Doe");
  });

  it("trims the image during creation", () => {
    const user = User.create({
      ...validUserParams,
      image: "  https://example.com/avatar.png  ",
    })._unsafeUnwrap();
    expect(user.image).toBe("https://example.com/avatar.png");
  });

  it("sets empty image to null during creation", () => {
    const user = User.create({
      ...validUserParams,
      image: "",
    })._unsafeUnwrap();
    expect(user.image).toBeNull();
  });

  it("rejects empty name on creation", () => {
    const result = User.create({
      ...validUserParams,
      name: "",
    });
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("NAME_REQUIRED");
  });

  it("rejects whitespace-only name on creation", () => {
    const result = User.create({
      ...validUserParams,
      name: "   ",
    });
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("NAME_REQUIRED");
  });

  describe("updateProfile", () => {
    it("updates name and image and returns a new User instance", () => {
      const user = User.create(validUserParams)._unsafeUnwrap();
      const updated = user
        .updateProfile("Jane Doe", "https://example.com/new.png")
        ._unsafeUnwrap();

      expect(updated).not.toBe(user);
      expect(updated.name).toBe("Jane Doe");
      expect(updated.image).toBe("https://example.com/new.png");
      // email and other fields remain unchanged
      expect(updated.email).toBe("test@example.com");
      expect(updated.id).toBe("user-123");
      expect(updated.role).toBe("user");
    });

    it("rejects empty name on update", () => {
      const user = User.create(validUserParams)._unsafeUnwrap();
      const result = user.updateProfile("", "https://example.com/new.png");
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe("NAME_REQUIRED");
    });

    it("rejects whitespace-only name on update", () => {
      const user = User.create(validUserParams)._unsafeUnwrap();
      const result = user.updateProfile("   ", "https://example.com/new.png");
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe("NAME_REQUIRED");
    });

    it("trims the updated name and image", () => {
      const user = User.create(validUserParams)._unsafeUnwrap();
      const updated = user
        .updateProfile("  Jane  ", "  https://example.com/new.png  ")
        ._unsafeUnwrap();
      expect(updated.name).toBe("Jane");
      expect(updated.image).toBe("https://example.com/new.png");
    });

    it("sets empty image string to null", () => {
      const user = User.create(validUserParams)._unsafeUnwrap();
      const updated = user.updateProfile("Jane", "")._unsafeUnwrap();
      expect(updated.image).toBeNull();
    });
  });

  describe("changeRole", () => {
    const actorUser = User.create({
      ...validUserParams,
      id: "actor-user",
      role: "user",
    })._unsafeUnwrap();
    const actorAdmin = User.create({
      ...validUserParams,
      id: "actor-admin",
      role: "admin",
    })._unsafeUnwrap();
    const actorSuperAdmin = User.create({
      ...validUserParams,
      id: "actor-super",
      role: "super_admin",
    })._unsafeUnwrap();

    it("rejects modifications on super_admin target", () => {
      const superAdminTarget = User.create({
        ...validUserParams,
        id: "target-super",
        role: "super_admin",
      })._unsafeUnwrap();
      const result = superAdminTarget.changeRole(actorSuperAdmin, "admin");
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe("SUPER_ADMIN_IMMUTABLE");
    });

    it("rejects self-demotion/self-modification", () => {
      const adminTarget = User.create({
        ...validUserParams,
        id: "actor-admin",
        role: "admin",
      })._unsafeUnwrap();
      const result = adminTarget.changeRole(actorAdmin, "user");
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe("SELF_DEMOTION_NOT_ALLOWED");
    });

    it("rejects non-admin/non-super-admin actors", () => {
      const target = User.create({
        ...validUserParams,
        id: "target-user",
        role: "user",
      })._unsafeUnwrap();
      const result = target.changeRole(actorUser, "admin");
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe("FORBIDDEN");
    });

    it("allows admin to change user's role", () => {
      const target = User.create({
        ...validUserParams,
        id: "target-user",
        role: "user",
      })._unsafeUnwrap();
      const updated = target.changeRole(actorAdmin, "admin")._unsafeUnwrap();
      expect(updated.role).toBe("admin");
    });

    it("allows super_admin to change user's role", () => {
      const target = User.create({
        ...validUserParams,
        id: "target-user",
        role: "user",
      })._unsafeUnwrap();
      const updated = target
        .changeRole(actorSuperAdmin, "admin")
        ._unsafeUnwrap();
      expect(updated.role).toBe("admin");
    });
  });
});
