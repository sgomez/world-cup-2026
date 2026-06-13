import { describe, expect, it, vi } from "vitest";
import { User } from "../domain/user";
import { PrismaUserRepository } from "./prisma-user-repository";

const ROW = {
  id: "user-123",
  email: "test@example.com",
  name: "John Doe",
  emailVerified: true,
  image: "https://example.com/avatar.png",
  role: "user",
  banned: false,
  banReason: null,
  banExpires: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function fakePrisma() {
  return {
    user: {
      findUnique: vi.fn(),
      count: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
  };
}

describe("PrismaUserRepository", () => {
  describe("findById", () => {
    it("maps a native user row to a User aggregate", async () => {
      const prisma = fakePrisma();
      prisma.user.findUnique.mockResolvedValue(ROW);
      const repo = new PrismaUserRepository(prisma as never);

      const user = await repo.findById("user-123");

      expect(user?.toState()).toEqual({
        id: ROW.id,
        email: ROW.email,
        name: ROW.name,
        emailVerified: ROW.emailVerified,
        image: ROW.image,
        role: ROW.role,
        banned: ROW.banned,
        banReason: ROW.banReason,
        banExpires: ROW.banExpires,
        createdAt: ROW.createdAt,
        updatedAt: ROW.updatedAt,
      });
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: "user-123" },
      });
    });

    it("returns null if user does not exist", async () => {
      const prisma = fakePrisma();
      prisma.user.findUnique.mockResolvedValue(null);
      const repo = new PrismaUserRepository(prisma as never);

      const user = await repo.findById("missing");
      expect(user).toBeNull();
    });
  });

  describe("findByEmail", () => {
    it("maps a native user row to a User aggregate", async () => {
      const prisma = fakePrisma();
      prisma.user.findUnique.mockResolvedValue(ROW);
      const repo = new PrismaUserRepository(prisma as never);

      const user = await repo.findByEmail("test@example.com");

      expect(user?.toState()).toEqual({
        id: ROW.id,
        email: ROW.email,
        name: ROW.name,
        emailVerified: ROW.emailVerified,
        image: ROW.image,
        role: ROW.role,
        banned: ROW.banned,
        banReason: ROW.banReason,
        banExpires: ROW.banExpires,
        createdAt: ROW.createdAt,
        updatedAt: ROW.updatedAt,
      });
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: "test@example.com" },
      });
    });
  });

  describe("count", () => {
    it("returns the number of users", async () => {
      const prisma = fakePrisma();
      prisma.user.count.mockResolvedValue(42);
      const repo = new PrismaUserRepository(prisma as never);

      const count = await repo.count();
      expect(count).toBe(42);
      expect(prisma.user.count).toHaveBeenCalled();
    });
  });

  describe("save", () => {
    it("upserts the user aggregate via prisma", async () => {
      const prisma = fakePrisma();
      prisma.user.upsert.mockResolvedValue(ROW);
      const repo = new PrismaUserRepository(prisma as never);
      const user = User.create({
        id: "user-123",
        email: "test@example.com",
        name: "John Doe",
        emailVerified: true,
        image: "https://example.com/avatar.png",
      })._unsafeUnwrap();

      const result = await repo.save(user);

      expect(result.isOk()).toBe(true);
      expect(prisma.user.upsert).toHaveBeenCalledWith({
        where: { id: "user-123" },
        create: expect.objectContaining({
          id: "user-123",
          email: "test@example.com",
          name: "John Doe",
          image: "https://example.com/avatar.png",
        }),
        update: expect.objectContaining({
          name: "John Doe",
          image: "https://example.com/avatar.png",
        }),
      });
    });
  });

  describe("delete", () => {
    it("deletes the user from the repository", async () => {
      const prisma = fakePrisma();
      prisma.user.delete.mockResolvedValue(ROW);
      const repo = new PrismaUserRepository(prisma as never);

      const result = await repo.delete("user-123");

      expect(result.isOk()).toBe(true);
      expect(prisma.user.delete).toHaveBeenCalledWith({
        where: { id: "user-123" },
      });
    });
  });
});
