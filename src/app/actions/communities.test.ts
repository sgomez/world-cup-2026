import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    community: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    communityMember: {
      create: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));
vi.mock("@/lib/session", () => ({ getSession: vi.fn() }));

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { createCommunity, getCommunity, joinCommunity } from "./communities";

const mockGetSession = vi.mocked(getSession);
const mockRedirect = vi.mocked(redirect);
const mockCommunityCreate = vi.mocked(prisma.community.create);
const mockCommunityFindUnique = vi.mocked(prisma.community.findUnique);
const mockCommunityMemberUpsert = vi.mocked(prisma.communityMember.upsert);

const USER_ID = "user-1";
const COMMUNITY_ID = "community-1";
const COMMUNITY_SLUG = "my-friends";

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

  it("creates community with slug derived from name, adds owner as member, redirects to community page", async () => {
    mockSession();
    mockCommunityFindUnique.mockResolvedValue(null);
    mockCommunityCreate.mockResolvedValue({
      id: COMMUNITY_ID,
      slug: COMMUNITY_SLUG,
    } as Awaited<ReturnType<typeof mockCommunityCreate>>);

    const fd = new FormData();
    fd.append("name", "My Friends");
    await createCommunity(null, fd);

    expect(mockCommunityCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "My Friends",
          slug: COMMUNITY_SLUG,
          ownerId: USER_ID,
          members: {
            create: { userId: USER_ID },
          },
        }),
      }),
    );
    expect(mockRedirect).toHaveBeenCalledWith(`/communities/${COMMUNITY_SLUG}`);
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

  it("returns error when name contains only non-alphanumeric characters", async () => {
    mockSession();
    const fd = new FormData();
    fd.append("name", "!!!");
    const result = await createCommunity(null, fd);
    expect(result).toEqual({
      error: "Name must contain at least one letter or digit",
    });
    expect(mockCommunityCreate).not.toHaveBeenCalled();
  });

  it("retries on P2002 slug collision and redirects to community page", async () => {
    mockSession();
    mockCommunityFindUnique.mockResolvedValue(null);
    const p2002 = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed",
      { code: "P2002", clientVersion: "5.0" },
    );
    mockCommunityCreate.mockRejectedValueOnce(p2002).mockResolvedValueOnce({
      id: COMMUNITY_ID,
      slug: "my-friends-2",
    } as Awaited<ReturnType<typeof mockCommunityCreate>>);

    const fd = new FormData();
    fd.append("name", "My Friends");
    await createCommunity(null, fd);

    expect(mockCommunityCreate).toHaveBeenCalledTimes(2);
    expect(mockRedirect).toHaveBeenCalledWith("/communities/my-friends-2");
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

describe("joinCommunity", () => {
  it("returns error when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    const result = await joinCommunity("some-token", null, new FormData());
    expect(result).toEqual({ error: "Not authenticated" });
    expect(mockCommunityFindUnique).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ inviteToken: expect.anything() }),
      }),
    );
  });

  it("returns error for invalid or unknown token", async () => {
    mockSession();
    mockCommunityFindUnique.mockResolvedValue(null);
    const result = await joinCommunity("bad-token", null, new FormData());
    expect(result).toEqual({ error: "Invalid or expired invite link" });
    expect(mockCommunityMemberUpsert).not.toHaveBeenCalled();
  });

  it("adds member and redirects to community slug on valid token", async () => {
    mockSession();
    mockCommunityFindUnique.mockResolvedValue({
      id: COMMUNITY_ID,
      slug: COMMUNITY_SLUG,
    } as Awaited<ReturnType<typeof mockCommunityFindUnique>>);
    mockCommunityMemberUpsert.mockResolvedValue(
      {} as Awaited<ReturnType<typeof mockCommunityMemberUpsert>>,
    );

    await joinCommunity("valid-token", null, new FormData());

    expect(mockCommunityMemberUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          communityId_userId: {
            communityId: COMMUNITY_ID,
            userId: USER_ID,
          },
        },
        create: { communityId: COMMUNITY_ID, userId: USER_ID },
        update: {},
      }),
    );
    expect(mockRedirect).toHaveBeenCalledWith(`/communities/${COMMUNITY_SLUG}`);
  });

  it("redirects existing member without error (idempotent rejoin)", async () => {
    mockSession();
    mockCommunityFindUnique.mockResolvedValue({
      id: COMMUNITY_ID,
      slug: COMMUNITY_SLUG,
    } as Awaited<ReturnType<typeof mockCommunityFindUnique>>);
    mockCommunityMemberUpsert.mockResolvedValue(
      {} as Awaited<ReturnType<typeof mockCommunityMemberUpsert>>,
    );

    await joinCommunity("valid-token", null, new FormData());

    expect(mockCommunityMemberUpsert).toHaveBeenCalledTimes(1);
    expect(mockRedirect).toHaveBeenCalledWith(`/communities/${COMMUNITY_SLUG}`);
  });
});

const OWNER_ID = "owner-1";

function makeCommunity(memberUserIds: string[]) {
  return {
    id: COMMUNITY_ID,
    slug: COMMUNITY_SLUG,
    name: "My Friends",
    ownerId: OWNER_ID,
    inviteToken: "tok",
    createdAt: new Date(),
    updatedAt: new Date(),
    owner: { name: "Owner Name" },
    members: memberUserIds.map((uid) => ({
      userId: uid,
      communityId: COMMUNITY_ID,
      joinedAt: new Date(),
      user: { id: uid, name: `User ${uid}` },
    })),
  } as Awaited<ReturnType<typeof mockCommunityFindUnique>>;
}

describe("getCommunity", () => {
  it("returns null when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    const result = await getCommunity("any-slug");
    expect(result).toBeNull();
    expect(mockCommunityFindUnique).not.toHaveBeenCalled();
  });

  it("returns null when community does not exist", async () => {
    mockSession();
    mockCommunityFindUnique.mockResolvedValue(null);
    const result = await getCommunity("nonexistent");
    expect(result).toBeNull();
  });

  it("returns null when authenticated user is not a member", async () => {
    mockSession("non-member");
    mockCommunityFindUnique.mockResolvedValue(makeCommunity([USER_ID]));
    const result = await getCommunity(COMMUNITY_SLUG);
    expect(result).toBeNull();
  });

  it("returns community data when user is a member", async () => {
    mockSession();
    mockCommunityFindUnique.mockResolvedValue(makeCommunity([USER_ID]));
    const result = await getCommunity(COMMUNITY_SLUG);
    expect(result).not.toBeNull();
    expect(result?.id).toBe(COMMUNITY_ID);
    expect(result?.currentUserId).toBe(USER_ID);
  });

  it("returns community data when user is the owner", async () => {
    mockSession(OWNER_ID);
    mockCommunityFindUnique.mockResolvedValue(makeCommunity([OWNER_ID]));
    const result = await getCommunity(COMMUNITY_SLUG);
    expect(result).not.toBeNull();
    expect(result?.currentUserId).toBe(OWNER_ID);
  });
});
