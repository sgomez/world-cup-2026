import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "./auth";
import { prisma } from "./prisma";

vi.mock("./prisma", () => {
  return {
    prisma: {
      user: {
        findUnique: vi.fn(),
        count: vi.fn(),
        upsert: vi.fn(),
      },
    },
  };
});

const mockUserFindUnique = vi.mocked(prisma.user.findUnique);
const mockUserCount = vi.mocked(prisma.user.count);
const mockUserUpsert = vi.mocked(prisma.user.upsert);

describe("auth first registrant promotion integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("promotes first human registrant even if an Import Owner user (non-super_admin) already exists", async () => {
    const hook = (auth as any).options?.databaseHooks?.user?.create?.after;
    expect(hook).toBeDefined();

    // The registered user
    const newUser = {
      id: "human-1",
      email: "human@example.com",
      name: "Human One",
      emailVerified: true,
      image: null,
      role: "user",
      banned: false,
      banReason: null,
      banExpires: null,
    };

    // 1. repo.findById queries user
    mockUserFindUnique.mockResolvedValue(newUser);

    // 2. repo.countByRole("super_admin") queries count of super admins
    mockUserCount.mockImplementation(async (args?: any) => {
      if (args?.where?.role === "super_admin") {
        return 0; // No super_admin exists yet!
      }
      return 1; // e.g. total user count is 1 (the Import Owner)
    });

    // 3. Mock save (upsert)
    mockUserUpsert.mockResolvedValue(newUser);

    // Trigger the hook
    await hook({ id: "human-1" });

    // Verify it counted by role 'super_admin'
    expect(mockUserCount).toHaveBeenCalledWith({
      where: { role: "super_admin" },
    });

    // Verify it updated the user to super_admin
    expect(mockUserUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "human-1" },
        create: expect.objectContaining({
          role: "super_admin",
        }),
        update: expect.objectContaining({
          role: "super_admin",
        }),
      }),
    );
  });

  it("promotes first human registrant, but does not promote subsequent registrants", async () => {
    const hook = (auth as any).options?.databaseHooks?.user?.create?.after;
    expect(hook).toBeDefined();

    // First human registers:
    const firstUser = {
      id: "human-1",
      email: "human1@example.com",
      name: "Human One",
      emailVerified: true,
      image: null,
      role: "user",
      banned: false,
      banReason: null,
      banExpires: null,
    };
    mockUserFindUnique.mockResolvedValue(firstUser);
    mockUserCount.mockImplementation(async (args?: any) => {
      if (args?.where?.role === "super_admin") {
        return 0; // No super admin
      }
      return 0;
    });
    mockUserUpsert.mockResolvedValue(firstUser);

    await hook({ id: "human-1" });

    // Verify first human is promoted
    expect(mockUserUpsert).toHaveBeenCalledTimes(1);
    expect(mockUserUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "human-1" },
        create: expect.objectContaining({ role: "super_admin" }),
      }),
    );

    // Reset mocks for subsequent registrant
    vi.clearAllMocks();

    const secondUser = {
      id: "human-2",
      email: "human2@example.com",
      name: "Human Two",
      emailVerified: true,
      image: null,
      role: "user",
      banned: false,
      banReason: null,
      banExpires: null,
    };
    mockUserFindUnique.mockResolvedValue(secondUser);
    mockUserCount.mockImplementation(async (args?: any) => {
      if (args?.where?.role === "super_admin") {
        return 1; // 1 super admin exists now!
      }
      return 1;
    });

    await hook({ id: "human-2" });

    // Verify second human is NOT promoted (save/upsert is not called)
    expect(mockUserUpsert).not.toHaveBeenCalled();
  });
});
