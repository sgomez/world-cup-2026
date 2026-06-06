import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next-intl/server", () => ({
  getLocale: vi.fn().mockResolvedValue("en"),
}));
vi.mock("@/i18n/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/bet-constants", () => ({
  BET_DEADLINE: new Date("2026-06-11T19:00:00Z"),
  MAX_BETS_PER_USER: 3,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    community: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    communityMember: {
      create: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
  },
}));
vi.mock("@/lib/session", () => ({ getSession: vi.fn() }));

import { redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import {
  createCommunity,
  deleteCommunity,
  getCommunity,
  joinCommunity,
  leaveCommunity,
  regenerateInviteToken,
  removeMember,
} from "./communities";

const mockGetSession = vi.mocked(getSession);
const mockRedirect = vi.mocked(redirect);
const mockCommunityCreate = vi.mocked(prisma.community.create);
const mockCommunityFindUnique = vi.mocked(prisma.community.findUnique);
const mockCommunityUpdate = vi.mocked(prisma.community.update);
const mockCommunityDelete = vi.mocked(prisma.community.delete);
const mockCommunityMemberUpsert = vi.mocked(prisma.communityMember.upsert);
const mockCommunityMemberDelete = vi.mocked(prisma.communityMember.delete);

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
    expect(mockRedirect).toHaveBeenCalledWith({
      href: `/communities/${COMMUNITY_SLUG}`,
      locale: "en",
    });
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
    expect(mockRedirect).toHaveBeenCalledWith({
      href: "/communities/my-friends-2",
      locale: "en",
    });
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
    expect(mockRedirect).toHaveBeenCalledWith({
      href: `/communities/${COMMUNITY_SLUG}`,
      locale: "en",
    });
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
    expect(mockRedirect).toHaveBeenCalledWith({
      href: `/communities/${COMMUNITY_SLUG}`,
      locale: "en",
    });
  });
});

const OWNER_ID = "owner-1";

type MockBet = {
  id: string;
  label: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

function makeBet(overrides: Partial<MockBet> = {}): MockBet {
  return {
    id: randomUUID(),
    label: "My Bet",
    status: "draft",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeCommunity(memberUserIds: string[], betsPerUser: MockBet[] = []) {
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
      user: { id: uid, name: `User ${uid}`, bets: betsPerUser },
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

  it("returns isPastDeadline false before the bet deadline", async () => {
    mockSession();
    mockCommunityFindUnique.mockResolvedValue(makeCommunity([USER_ID]));
    const result = await getCommunity(COMMUNITY_SLUG);
    expect(result?.isPastDeadline).toBe(false);
  });

  it("hides member bets before the bet deadline", async () => {
    mockSession();
    mockCommunityFindUnique.mockResolvedValue(
      makeCommunity([USER_ID], [makeBet()]),
    );
    const result = await getCommunity(COMMUNITY_SLUG);
    expect(result?.members[0].user.bets).toHaveLength(0);
  });

  it("returns isPastDeadline true after the bet deadline", async () => {
    const { BET_DEADLINE } = await import("@/lib/bet-constants");
    vi.spyOn(BET_DEADLINE, "getTime").mockReturnValue(Date.now() - 1000);
    mockSession();
    mockCommunityFindUnique.mockResolvedValue(makeCommunity([USER_ID]));
    const result = await getCommunity(COMMUNITY_SLUG);
    expect(result?.isPastDeadline).toBe(true);
    vi.restoreAllMocks();
  });

  it("exposes member bets after the bet deadline", async () => {
    const { BET_DEADLINE } = await import("@/lib/bet-constants");
    vi.spyOn(BET_DEADLINE, "getTime").mockReturnValue(Date.now() - 1000);
    mockSession();
    const bet = makeBet();
    mockCommunityFindUnique.mockResolvedValue(makeCommunity([USER_ID], [bet]));
    const result = await getCommunity(COMMUNITY_SLUG);
    expect(result?.members[0].user.bets).toHaveLength(1);
    expect(result?.members[0].user.bets[0].id).toBe(bet.id);
    vi.restoreAllMocks();
  });
});

function mockCommunity(ownerId = OWNER_ID) {
  mockCommunityFindUnique.mockResolvedValue({
    id: COMMUNITY_ID,
    slug: COMMUNITY_SLUG,
    ownerId,
  } as Awaited<ReturnType<typeof mockCommunityFindUnique>>);
}

describe("leaveCommunity", () => {
  it("returns error when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    const result = await leaveCommunity(COMMUNITY_SLUG, null, new FormData());
    expect(result).toEqual({ error: "Not authenticated" });
  });

  it("returns error when community not found", async () => {
    mockSession();
    mockCommunityFindUnique.mockResolvedValue(null);
    const result = await leaveCommunity(COMMUNITY_SLUG, null, new FormData());
    expect(result).toEqual({ error: "Community not found" });
    expect(mockCommunityMemberDelete).not.toHaveBeenCalled();
  });

  it("returns error when owner tries to leave", async () => {
    mockSession(OWNER_ID);
    mockCommunity();
    const result = await leaveCommunity(COMMUNITY_SLUG, null, new FormData());
    expect(result).toEqual({
      error: "Owner cannot leave. Delete the community instead.",
    });
    expect(mockCommunityMemberDelete).not.toHaveBeenCalled();
  });

  it("removes membership and redirects for a regular member", async () => {
    mockSession(USER_ID);
    mockCommunity();
    mockCommunityMemberDelete.mockResolvedValue(
      {} as Awaited<ReturnType<typeof mockCommunityMemberDelete>>,
    );

    await leaveCommunity(COMMUNITY_SLUG, null, new FormData());

    expect(mockCommunityMemberDelete).toHaveBeenCalledWith({
      where: {
        communityId_userId: { communityId: COMMUNITY_ID, userId: USER_ID },
      },
    });
    expect(mockRedirect).toHaveBeenCalledWith({
      href: "/communities",
      locale: "en",
    });
  });
});

describe("removeMember", () => {
  it("returns error when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    const result = await removeMember(
      COMMUNITY_SLUG,
      USER_ID,
      null,
      new FormData(),
    );
    expect(result).toEqual({ error: "Not authenticated" });
  });

  it("returns error when community not found", async () => {
    mockSession(OWNER_ID);
    mockCommunityFindUnique.mockResolvedValue(null);
    const result = await removeMember(
      COMMUNITY_SLUG,
      USER_ID,
      null,
      new FormData(),
    );
    expect(result).toEqual({ error: "Community not found" });
    expect(mockCommunityMemberDelete).not.toHaveBeenCalled();
  });

  it("returns error for non-owner caller", async () => {
    mockSession(USER_ID);
    mockCommunity();
    const result = await removeMember(
      COMMUNITY_SLUG,
      "another-user",
      null,
      new FormData(),
    );
    expect(result).toEqual({ error: "Only the owner can remove members" });
    expect(mockCommunityMemberDelete).not.toHaveBeenCalled();
  });

  it("returns error when owner tries to remove themselves", async () => {
    mockSession(OWNER_ID);
    mockCommunity();
    const result = await removeMember(
      COMMUNITY_SLUG,
      OWNER_ID,
      null,
      new FormData(),
    );
    expect(result).toEqual({ error: "Owner cannot remove themselves" });
    expect(mockCommunityMemberDelete).not.toHaveBeenCalled();
  });

  it("removes the target member and returns success", async () => {
    mockSession(OWNER_ID);
    mockCommunity();
    mockCommunityMemberDelete.mockResolvedValue(
      {} as Awaited<ReturnType<typeof mockCommunityMemberDelete>>,
    );

    const result = await removeMember(
      COMMUNITY_SLUG,
      USER_ID,
      null,
      new FormData(),
    );

    expect(mockCommunityMemberDelete).toHaveBeenCalledWith({
      where: {
        communityId_userId: { communityId: COMMUNITY_ID, userId: USER_ID },
      },
    });
    expect(result).toEqual({ success: true });
  });
});

describe("deleteCommunity", () => {
  it("returns error when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    const result = await deleteCommunity(COMMUNITY_SLUG, null, new FormData());
    expect(result).toEqual({ error: "Not authenticated" });
  });

  it("returns error when community not found", async () => {
    mockSession(OWNER_ID);
    mockCommunityFindUnique.mockResolvedValue(null);
    const result = await deleteCommunity(COMMUNITY_SLUG, null, new FormData());
    expect(result).toEqual({ error: "Community not found" });
    expect(mockCommunityDelete).not.toHaveBeenCalled();
  });

  it("returns error for non-owner caller", async () => {
    mockSession(USER_ID);
    mockCommunity();
    const result = await deleteCommunity(COMMUNITY_SLUG, null, new FormData());
    expect(result).toEqual({
      error: "Only the owner can delete the community",
    });
    expect(mockCommunityDelete).not.toHaveBeenCalled();
  });

  it("deletes the community and redirects for the owner", async () => {
    mockSession(OWNER_ID);
    mockCommunity();
    mockCommunityDelete.mockResolvedValue(
      {} as Awaited<ReturnType<typeof mockCommunityDelete>>,
    );

    await deleteCommunity(COMMUNITY_SLUG, null, new FormData());

    expect(mockCommunityDelete).toHaveBeenCalledWith({
      where: { id: COMMUNITY_ID },
    });
    expect(mockRedirect).toHaveBeenCalledWith({
      href: "/communities",
      locale: "en",
    });
  });
});

describe("regenerateInviteToken", () => {
  it("returns error when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    const result = await regenerateInviteToken(
      COMMUNITY_SLUG,
      null,
      new FormData(),
    );
    expect(result).toEqual({ error: "Not authenticated" });
  });

  it("returns error when community not found", async () => {
    mockSession(OWNER_ID);
    mockCommunityFindUnique.mockResolvedValue(null);
    const result = await regenerateInviteToken(
      COMMUNITY_SLUG,
      null,
      new FormData(),
    );
    expect(result).toEqual({ error: "Community not found" });
    expect(mockCommunityUpdate).not.toHaveBeenCalled();
  });

  it("returns error for non-owner caller", async () => {
    mockSession(USER_ID);
    mockCommunity();
    const result = await regenerateInviteToken(
      COMMUNITY_SLUG,
      null,
      new FormData(),
    );
    expect(result).toEqual({
      error: "Only the owner can regenerate the invite link",
    });
    expect(mockCommunityUpdate).not.toHaveBeenCalled();
  });

  it("updates invite token and returns success for owner", async () => {
    mockSession(OWNER_ID);
    mockCommunity();
    mockCommunityUpdate.mockResolvedValue(
      {} as Awaited<ReturnType<typeof mockCommunityUpdate>>,
    );

    const result = await regenerateInviteToken(
      COMMUNITY_SLUG,
      null,
      new FormData(),
    );

    const call = mockCommunityUpdate.mock.calls[0][0];
    const token = call.data.inviteToken as string;
    expect(call.where).toEqual({ id: COMMUNITY_ID });
    expect(token).toBeTruthy();
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(16);
    expect(result).toEqual({ success: true });
  });
});
