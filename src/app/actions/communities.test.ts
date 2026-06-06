import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    community: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    communityMember: {
      create: vi.fn(),
    },
  },
}));
vi.mock("@/lib/session", () => ({ getSession: vi.fn() }));

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { createCommunity } from "./communities";

const mockGetSession = vi.mocked(getSession);
const mockRedirect = vi.mocked(redirect);
const mockCommunityCreate = vi.mocked(prisma.community.create);
const mockCommunityFindUnique = vi.mocked(prisma.community.findUnique);

const USER_ID = "user-1";
const COMMUNITY_ID = "community-1";

function mockSession(userId = USER_ID) {
  mockGetSession.mockResolvedValue({ user: { id: userId } } as Awaited<
    ReturnType<typeof getSession>
  >);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createCommunity", () => {
  it("returns error when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    const fd = new FormData();
    fd.append("name", "My Friends");
    const result = await createCommunity(null, fd);
    expect(result).toEqual({ error: "Not authenticated" });
    expect(mockCommunityCreate).not.toHaveBeenCalled();
  });

  it("returns error when name is missing", async () => {
    mockSession();
    const fd = new FormData();
    const result = await createCommunity(null, fd);
    expect(result).toEqual({ error: "Name is required" });
    expect(mockCommunityCreate).not.toHaveBeenCalled();
  });

  it("creates community with slug derived from name, adds owner as member, redirects", async () => {
    mockSession();
    mockCommunityFindUnique.mockResolvedValue(null);
    mockCommunityCreate.mockResolvedValue({
      id: COMMUNITY_ID,
      slug: "my-friends",
    } as Awaited<ReturnType<typeof mockCommunityCreate>>);

    const fd = new FormData();
    fd.append("name", "My Friends");
    await createCommunity(null, fd);

    expect(mockCommunityCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "My Friends",
          slug: "my-friends",
          ownerId: USER_ID,
          members: {
            create: { userId: USER_ID },
          },
        }),
      }),
    );
    expect(mockRedirect).toHaveBeenCalledWith("/communities");
  });

  it("resolves duplicate slug by appending counter", async () => {
    mockSession();
    mockCommunityFindUnique
      .mockResolvedValueOnce({ id: "existing-1" } as Awaited<
        ReturnType<typeof mockCommunityFindUnique>
      >)
      .mockResolvedValueOnce({ id: "existing-2" } as Awaited<
        ReturnType<typeof mockCommunityFindUnique>
      >)
      .mockResolvedValueOnce(null);
    mockCommunityCreate.mockResolvedValue({
      id: COMMUNITY_ID,
      slug: "my-friends-3",
    } as Awaited<ReturnType<typeof mockCommunityCreate>>);

    const fd = new FormData();
    fd.append("name", "My Friends");
    await createCommunity(null, fd);

    expect(mockCommunityCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ slug: "my-friends-3" }),
      }),
    );
  });

  it("stores a non-empty invite token", async () => {
    mockSession();
    mockCommunityFindUnique.mockResolvedValue(null);
    mockCommunityCreate.mockResolvedValue({
      id: COMMUNITY_ID,
      slug: "test-community",
    } as Awaited<ReturnType<typeof mockCommunityCreate>>);

    const fd = new FormData();
    fd.append("name", "Test Community");
    await createCommunity(null, fd);

    const call = mockCommunityCreate.mock.calls[0][0];
    expect(call.data.inviteToken).toBeTruthy();
    expect(typeof call.data.inviteToken).toBe("string");
    expect(call.data.inviteToken.length).toBeGreaterThan(16);
  });
});
