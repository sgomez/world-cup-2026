import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next-intl/server", () => ({
  getLocale: vi.fn().mockResolvedValue("en"),
  getTranslations: vi.fn(
    async () =>
      (key: string): string =>
        (
          ({
            NOT_AUTHENTICATED: "Not authenticated",
            FORBIDDEN: "You are not authorized to perform this action",
            SELF_DEMOTION_NOT_ALLOWED: "You cannot change your own role",
            SUPER_ADMIN_IMMUTABLE: "Super Admin role cannot be modified",
          }) as Record<string, string>
        )[key] ?? key,
  ),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));
vi.mock("@/lib/session", () => ({ getSession: vi.fn() }));

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { setUserRole } from "./admin";

const mockGetSession = vi.mocked(getSession);
const mockUserFindUnique = vi.mocked(prisma.user.findUnique);
const mockUserUpsert = vi.mocked(prisma.user.upsert);
const mockRevalidatePath = vi.mocked(revalidatePath);

const ACTOR_ADMIN_ID = "actor-admin-123";
const ACTOR_ADMIN_USER = {
  id: ACTOR_ADMIN_ID,
  email: "admin@example.com",
  name: "Admin User",
  emailVerified: true,
  image: "https://example.com/avatar.png",
  role: "admin",
  banned: false,
  banReason: null,
  banExpires: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const TARGET_USER_ID = "target-user-456";
const TARGET_USER = {
  id: TARGET_USER_ID,
  email: "target@example.com",
  name: "Target User",
  emailVerified: true,
  image: "https://example.com/avatar2.png",
  role: "user",
  banned: false,
  banReason: null,
  banExpires: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("setUserRole action", () => {
  it("returns error when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);

    const result = await setUserRole(TARGET_USER_ID, "admin");
    expect(result).toEqual({ error: "Not authenticated" });
    expect(mockUserUpsert).not.toHaveBeenCalled();
  });

  it("returns error when target is super_admin", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: ACTOR_ADMIN_ID, role: "admin" },
    } as Awaited<ReturnType<typeof getSession>>);

    const superAdminTarget = { ...TARGET_USER, role: "super_admin" };

    // Repo findById loads actor first, then target
    mockUserFindUnique
      .mockResolvedValueOnce(ACTOR_ADMIN_USER)
      .mockResolvedValueOnce(superAdminTarget);

    const result = await setUserRole(TARGET_USER_ID, "admin");
    expect(result).toEqual({ error: "Super Admin role cannot be modified" });
    expect(mockUserUpsert).not.toHaveBeenCalled();
  });

  it("returns error when attempting self-demotion", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: ACTOR_ADMIN_ID, role: "admin" },
    } as Awaited<ReturnType<typeof getSession>>);

    // Repo findById loads actor first, then target (both are same)
    mockUserFindUnique
      .mockResolvedValueOnce(ACTOR_ADMIN_USER)
      .mockResolvedValueOnce(ACTOR_ADMIN_USER);

    const result = await setUserRole(ACTOR_ADMIN_ID, "user");
    expect(result).toEqual({ error: "You cannot change your own role" });
    expect(mockUserUpsert).not.toHaveBeenCalled();
  });

  it("returns error when actor is not an admin/super_admin", async () => {
    const regularActor = {
      ...ACTOR_ADMIN_USER,
      id: "regular-actor",
      role: "user",
    };
    mockGetSession.mockResolvedValue({
      user: { id: "regular-actor", role: "user" },
    } as Awaited<ReturnType<typeof getSession>>);

    mockUserFindUnique
      .mockResolvedValueOnce(regularActor)
      .mockResolvedValueOnce(TARGET_USER);

    const result = await setUserRole(TARGET_USER_ID, "admin");
    expect(result).toEqual({
      error: "You are not authorized to perform this action",
    });
    expect(mockUserUpsert).not.toHaveBeenCalled();
  });

  it("successfully changes user role and revalidates paths", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: ACTOR_ADMIN_ID, role: "admin" },
    } as Awaited<ReturnType<typeof getSession>>);

    mockUserFindUnique
      .mockResolvedValueOnce(ACTOR_ADMIN_USER)
      .mockResolvedValueOnce(TARGET_USER);

    mockUserUpsert.mockResolvedValue(TARGET_USER);

    const result = await setUserRole(TARGET_USER_ID, "admin");
    expect(result).toEqual({ success: true });

    expect(mockUserFindUnique).toHaveBeenNthCalledWith(1, {
      where: { id: ACTOR_ADMIN_ID },
    });
    expect(mockUserFindUnique).toHaveBeenNthCalledWith(2, {
      where: { id: TARGET_USER_ID },
    });

    expect(mockUserUpsert).toHaveBeenCalledWith({
      where: { id: TARGET_USER_ID },
      create: expect.objectContaining({
        id: TARGET_USER_ID,
        role: "admin",
      }),
      update: expect.objectContaining({
        role: "admin",
      }),
    });

    expect(mockRevalidatePath).toHaveBeenCalledWith("/admin");
    expect(mockRevalidatePath).toHaveBeenCalledWith(
      `/admin/users/${TARGET_USER_ID}`,
    );
  });
});
