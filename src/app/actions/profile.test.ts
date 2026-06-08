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
            NAME_REQUIRED: "Name is required",
          }) as Record<string, string>
        )[key] ?? key,
  ),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      update: vi.fn(),
    },
  },
}));
vi.mock("@/lib/session", () => ({ getSession: vi.fn() }));

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { updateProfile } from "./profile";

const mockGetSession = vi.mocked(getSession);
const mockUserUpdate = vi.mocked(prisma.user.update);
const mockRevalidatePath = vi.mocked(revalidatePath);

const USER_ID = "user-123";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("updateProfile", () => {
  it("returns error when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    const fd = new FormData();
    fd.append("name", "John Doe");
    const result = await updateProfile(null, fd);
    expect(result).toEqual({ error: "Not authenticated" });
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("returns error when name is missing", async () => {
    mockGetSession.mockResolvedValue({ user: { id: USER_ID } } as Awaited<
      ReturnType<typeof getSession>
    >);
    const fd = new FormData();
    const result = await updateProfile(null, fd);
    expect(result).toEqual({ error: "Name is required" });
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("updates user details and revalidates paths on success", async () => {
    mockGetSession.mockResolvedValue({ user: { id: USER_ID } } as Awaited<
      ReturnType<typeof getSession>
    >);
    const fd = new FormData();
    fd.append("name", "Jane Doe");
    fd.append("image", "https://example.com/avatar.png");

    const result = await updateProfile(null, fd);
    expect(result).toEqual({ success: true });
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: {
        name: "Jane Doe",
        image: "https://example.com/avatar.png",
      },
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/profile");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/");
  });

  it("updates user with null image when image is empty", async () => {
    mockGetSession.mockResolvedValue({ user: { id: USER_ID } } as Awaited<
      ReturnType<typeof getSession>
    >);
    const fd = new FormData();
    fd.append("name", "Jane Doe");
    fd.append("image", "");

    const result = await updateProfile(null, fd);
    expect(result).toEqual({ success: true });
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: {
        name: "Jane Doe",
        image: null,
      },
    });
  });
});
