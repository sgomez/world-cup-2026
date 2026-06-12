import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next-intl/server", () => ({
  getLocale: vi.fn().mockResolvedValue("en"),
  getTranslations: vi.fn(
    async () =>
      (key: string): string =>
        (
          ({
            NOT_FOUND: "Community not found",
            FORBIDDEN: "You are not authorized to modify this community.",
            INVALID_NAME: "Name must contain at least one letter or digit",
            INVALID_SLUG: "Community slug is invalid.",
            SLUG_ALREADY_EXISTS: "Community slug already exists.",
            OWNER_CANNOT_LEAVE:
              "Owner cannot leave the community. Delete it instead.",
            NOT_A_MEMBER: "You are not a member of this community.",
            SAVE_FAILED: "Failed to save the community. Please try again.",
            NOT_AUTHENTICATED: "Not authenticated",
          }) as Record<string, string>
        )[key] ?? key,
  ),
}));
vi.mock("@/i18n/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/bet-constants", () => ({
  BET_DEADLINE: new Date("2026-06-11T19:00:00Z"),
  MAX_BETS_PER_USER: 3,
}));
vi.mock("@/lib/prisma", () => {
  const mockPrisma = {
    $transaction: vi.fn((cb) => cb(mockPrisma)),
    community: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    communityMember: {
      create: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
    },
    bet: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    tournament: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    liveResult: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
  return { prisma: mockPrisma };
});
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
const mockCommunityFindUnique = vi.mocked(prisma.community.findUnique);
const mockCommunityDelete = vi.mocked(prisma.community.delete);
const mockCommunityUpsert = vi.mocked(prisma.community.upsert);
const mockCommunityMemberFindMany = vi.mocked(prisma.communityMember.findMany);
const mockCommunityMemberCreateMany = vi.mocked(
  prisma.communityMember.createMany,
);
const mockBetFindMany = vi.mocked(prisma.bet.findMany);
const mockCommunityMemberDeleteMany = vi.mocked(
  prisma.communityMember.deleteMany,
);

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

  mockBetFindMany.mockImplementation((async (args: unknown) => {
    const commResult = mockCommunityFindUnique.mock.results.at(-1)?.value;
    const comm = (
      commResult instanceof Promise ? await commResult : commResult
    ) as
      | {
          members?: {
            userId: string;
            user: {
              bets: {
                id: string;
                label: string;
                status: string;
                groupPredictions: unknown;
                knockoutWinners: unknown;
                createdAt: Date;
                updatedAt: Date;
              }[];
            };
          }[];
        }
      | null
      | undefined;
    if (!comm?.members) return [];
    const typedArgs = args as {
      where?: { userId?: { in?: string[] } | string };
    };
    const userIds =
      typedArgs?.where?.userId instanceof Object &&
      "in" in typedArgs.where.userId
        ? typedArgs.where.userId.in
        : typedArgs?.where?.userId
          ? [typedArgs.where.userId as string]
          : [];
    const bets: {
      id: string;
      label: string;
      status: string;
      groupPredictions: unknown;
      knockoutWinners: unknown;
      createdAt: Date;
      updatedAt: Date;
      userId: string;
    }[] = [];
    for (const member of comm.members) {
      if (userIds?.includes(member.userId)) {
        for (const b of member.user.bets) {
          bets.push({
            id: b.id,
            userId: member.userId,
            label: b.label,
            status: b.status,
            groupPredictions: b.groupPredictions,
            knockoutWinners: b.knockoutWinners,
            createdAt: b.createdAt,
            updatedAt: b.updatedAt,
          });
        }
      }
    }
    return bets;
  }) as unknown as typeof prisma.bet.findMany);
});

describe("createCommunity", () => {
  it("returns error when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    const fd = new FormData();
    fd.append("name", "My Friends");
    const result = await createCommunity(null, fd);
    expect(result).toEqual({ error: "Not authenticated" });
    expect(mockCommunityUpsert).not.toHaveBeenCalled();
  });

  it("returns error when name is missing", async () => {
    mockSession();
    const fd = new FormData();
    const result = await createCommunity(null, fd);
    expect(result).toEqual({
      error: "Name must contain at least one letter or digit",
    });
    expect(mockCommunityUpsert).not.toHaveBeenCalled();
  });

  it("creates community with slug derived from name, adds owner as member, redirects to community page", async () => {
    mockSession();
    mockCommunityFindUnique.mockResolvedValue(null);
    mockCommunityUpsert.mockResolvedValue({} as never);
    mockCommunityMemberFindMany.mockResolvedValue([]);
    mockCommunityMemberCreateMany.mockResolvedValue({} as never);

    const fd = new FormData();
    fd.append("name", "My Friends");
    await createCommunity(null, fd);

    expect(mockCommunityUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          name: "My Friends",
          slug: COMMUNITY_SLUG,
          ownerId: USER_ID,
        }),
      }),
    );
    expect(mockCommunityMemberCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ userId: USER_ID }),
        ]),
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
      .mockResolvedValueOnce({
        id: "existing-1",
        name: "Existing 1",
        slug: "my-friends",
        ownerId: USER_ID,
        inviteToken: "token-1",
        members: [],
      } as never)
      .mockResolvedValueOnce({
        id: "existing-2",
        name: "Existing 2",
        slug: "my-friends-2",
        ownerId: USER_ID,
        inviteToken: "token-2",
        members: [],
      } as never)
      .mockResolvedValueOnce(null);
    mockCommunityUpsert.mockResolvedValue({} as never);
    mockCommunityMemberFindMany.mockResolvedValue([]);
    mockCommunityMemberCreateMany.mockResolvedValue({} as never);

    const fd = new FormData();
    fd.append("name", "My Friends");
    await createCommunity(null, fd);

    expect(mockCommunityUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ slug: "my-friends-3" }),
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
    expect(mockCommunityUpsert).not.toHaveBeenCalled();
  });

  it("retries on P2002 slug collision and redirects to community page", async () => {
    mockSession();
    mockCommunityFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "existing-1",
        name: "My Friends",
        slug: "my-friends",
        ownerId: USER_ID,
        inviteToken: "token-1",
        members: [],
      } as never)
      .mockResolvedValueOnce(null);

    const p2002 = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed",
      { code: "P2002", clientVersion: "5.0", meta: { target: ["slug"] } },
    );
    mockCommunityUpsert
      .mockRejectedValueOnce(p2002)
      .mockResolvedValueOnce({} as never);
    mockCommunityMemberFindMany.mockResolvedValue([]);
    mockCommunityMemberCreateMany.mockResolvedValue({} as never);

    const fd = new FormData();
    fd.append("name", "My Friends");
    await createCommunity(null, fd);

    expect(mockCommunityUpsert).toHaveBeenCalledTimes(2);
    expect(mockRedirect).toHaveBeenCalledWith({
      href: "/communities/my-friends-2",
      locale: "en",
    });
  });

  it("stores a non-empty invite token", async () => {
    mockSession();
    mockCommunityFindUnique.mockResolvedValue(null);
    mockCommunityUpsert.mockResolvedValue({} as never);
    mockCommunityMemberFindMany.mockResolvedValue([]);
    mockCommunityMemberCreateMany.mockResolvedValue({} as never);

    const fd = new FormData();
    fd.append("name", "Test Community");
    await createCommunity(null, fd);

    const call = mockCommunityUpsert.mock.calls[0][0];
    expect(call.create.inviteToken).toBeTruthy();
    expect(typeof call.create.inviteToken).toBe("string");
    expect(call.create.inviteToken.length).toBeGreaterThan(16);
  });
});

describe("joinCommunity", () => {
  it("returns error when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    const result = await joinCommunity("some-token", null, new FormData());
    expect(result).toEqual({ error: "Not authenticated" });
    expect(mockCommunityFindUnique).not.toHaveBeenCalled();
  });

  it("returns error for invalid or unknown token", async () => {
    mockSession();
    mockCommunityFindUnique.mockResolvedValue(null);
    const result = await joinCommunity("bad-token", null, new FormData());
    expect(result).toEqual({ error: "Community not found" });
    expect(mockCommunityMemberCreateMany).not.toHaveBeenCalled();
  });

  it("adds member and redirects to community slug on valid token", async () => {
    mockSession();
    mockCommunityFindUnique.mockResolvedValue({
      id: COMMUNITY_ID,
      slug: COMMUNITY_SLUG,
      ownerId: OWNER_ID,
      inviteToken: "valid-token",
      members: [{ userId: OWNER_ID }],
    } as any);
    mockCommunityMemberFindMany.mockResolvedValue([
      { userId: OWNER_ID },
    ] as any);
    mockCommunityMemberCreateMany.mockResolvedValue({} as any);

    await joinCommunity("valid-token", null, new FormData());

    expect(mockCommunityMemberCreateMany).toHaveBeenCalledWith({
      data: [{ communityId: COMMUNITY_ID, userId: USER_ID }],
    });
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
      ownerId: OWNER_ID,
      inviteToken: "valid-token",
      members: [{ userId: OWNER_ID }, { userId: USER_ID }],
    } as any);
    mockCommunityMemberFindMany.mockResolvedValue([
      { userId: OWNER_ID },
      { userId: USER_ID },
    ] as any);

    await joinCommunity("valid-token", null, new FormData());

    expect(mockCommunityMemberCreateMany).not.toHaveBeenCalled();
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
  groupPredictions: unknown;
  knockoutWinners: unknown;
  createdAt: Date;
  updatedAt: Date;
};

function makeBet(overrides: Partial<MockBet> = {}): MockBet {
  return {
    id: randomUUID(),
    label: "My Bet",
    status: "draft",
    groupPredictions: null,
    knockoutWinners: null,
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
    imported: false,
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

  it("hides member bets before the bet deadline", async () => {
    mockSession();
    mockCommunityFindUnique.mockResolvedValue(
      makeCommunity([USER_ID], [makeBet()]),
    );
    const result = await getCommunity(COMMUNITY_SLUG);
    expect(result?.members[0].user.bets).toHaveLength(0);
  });

  it("exposes member bets after the bet deadline", async () => {
    const { BET_DEADLINE } = await import("@/lib/bet-constants");
    vi.spyOn(BET_DEADLINE, "getTime").mockReturnValue(Date.now() - 1000);
    mockSession();
    const bet = makeBet({ status: "closed" });
    mockCommunityFindUnique.mockResolvedValue(makeCommunity([USER_ID], [bet]));
    const result = await getCommunity(COMMUNITY_SLUG);
    expect(result?.members[0].user.bets).toHaveLength(1);
    expect(result?.members[0].user.bets[0].id).toBe(bet.id);
    vi.restoreAllMocks();
  });

  it("exposes closed bets before deadline with signature, no prediction fields", async () => {
    mockSession();
    const bet = makeBet({ status: "closed" });
    mockCommunityFindUnique.mockResolvedValue(makeCommunity([USER_ID], [bet]));
    const result = await getCommunity(COMMUNITY_SLUG);
    const bets = result?.members[0].user.bets;
    expect(bets).toHaveLength(1);
    expect(bets?.[0].id).toBe(bet.id);
    expect((bets?.[0] as Record<string, unknown>).signature).toBeTypeOf(
      "string",
    );
    expect(
      (bets?.[0] as Record<string, unknown>).groupPredictions,
    ).toBeUndefined();
    expect(
      (bets?.[0] as Record<string, unknown>).knockoutWinners,
    ).toBeUndefined();
  });

  it("hides draft bets before deadline for other members", async () => {
    mockSession();
    const draft = makeBet({ status: "draft" });
    mockCommunityFindUnique.mockResolvedValue(
      makeCommunity([USER_ID], [draft]),
    );
    const result = await getCommunity(COMMUNITY_SLUG);
    expect(result?.members[0].user.bets).toHaveLength(0);
  });

  it("attaches signature to closed bets after deadline, strips prediction fields", async () => {
    const { BET_DEADLINE } = await import("@/lib/bet-constants");
    vi.spyOn(BET_DEADLINE, "getTime").mockReturnValue(Date.now() - 1000);
    mockSession();
    const bet = makeBet({ status: "closed" });
    mockCommunityFindUnique.mockResolvedValue(makeCommunity([USER_ID], [bet]));
    const result = await getCommunity(COMMUNITY_SLUG);
    const b = result?.members[0].user.bets[0];
    expect((b as Record<string, unknown>).signature).toBeTypeOf("string");
    expect((b as Record<string, unknown>).groupPredictions).toBeUndefined();
    expect((b as Record<string, unknown>).knockoutWinners).toBeUndefined();
    vi.restoreAllMocks();
  });

  it("hides draft bets after deadline", async () => {
    const { BET_DEADLINE } = await import("@/lib/bet-constants");
    vi.spyOn(BET_DEADLINE, "getTime").mockReturnValue(Date.now() - 1000);
    mockSession();
    const bet = makeBet({ status: "draft" });
    mockCommunityFindUnique.mockResolvedValue(makeCommunity([USER_ID], [bet]));
    const result = await getCommunity(COMMUNITY_SLUG);
    expect(result?.members[0].user.bets).toHaveLength(0);
    vi.restoreAllMocks();
  });
});

function mockCommunity(
  ownerId = OWNER_ID,
  memberUserIds: string[] = [ownerId],
) {
  mockCommunityFindUnique.mockResolvedValue({
    id: COMMUNITY_ID,
    slug: COMMUNITY_SLUG,
    name: "My Friends",
    ownerId,
    inviteToken: "tok",
    imported: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    members: memberUserIds.map((uid) => ({ userId: uid })),
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
    expect(mockCommunityMemberDeleteMany).not.toHaveBeenCalled();
  });

  it("returns error when owner tries to leave", async () => {
    mockSession(OWNER_ID);
    mockCommunity(OWNER_ID, [OWNER_ID]);
    const result = await leaveCommunity(COMMUNITY_SLUG, null, new FormData());
    expect(result).toEqual({
      error: "Owner cannot leave the community. Delete it instead.",
    });
    expect(mockCommunityMemberDeleteMany).not.toHaveBeenCalled();
  });

  it("removes membership and redirects for a regular member", async () => {
    mockSession(USER_ID);
    mockCommunity(OWNER_ID, [OWNER_ID, USER_ID]);
    mockCommunityMemberFindMany.mockResolvedValue([
      { userId: OWNER_ID },
      { userId: USER_ID },
    ] as any);
    mockCommunityMemberDeleteMany.mockResolvedValue({} as any);

    await leaveCommunity(COMMUNITY_SLUG, null, new FormData());

    expect(mockCommunityMemberDeleteMany).toHaveBeenCalledWith({
      where: {
        communityId: COMMUNITY_ID,
        userId: { in: [USER_ID] },
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
    expect(mockCommunityMemberDeleteMany).not.toHaveBeenCalled();
  });

  it("returns error for non-owner caller", async () => {
    mockSession(USER_ID);
    mockCommunity(OWNER_ID, [OWNER_ID, USER_ID, "another-user"]);
    const result = await removeMember(
      COMMUNITY_SLUG,
      "another-user",
      null,
      new FormData(),
    );
    expect(result).toEqual({
      error: "You are not authorized to modify this community.",
    });
    expect(mockCommunityMemberDeleteMany).not.toHaveBeenCalled();
  });

  it("returns error when owner tries to remove themselves", async () => {
    mockSession(OWNER_ID);
    mockCommunity(OWNER_ID, [OWNER_ID, USER_ID]);
    const result = await removeMember(
      COMMUNITY_SLUG,
      OWNER_ID,
      null,
      new FormData(),
    );
    expect(result).toEqual({
      error: "You are not authorized to modify this community.",
    });
    expect(mockCommunityMemberDeleteMany).not.toHaveBeenCalled();
  });

  it("removes the target member and returns success", async () => {
    mockSession(OWNER_ID);
    mockCommunity(OWNER_ID, [OWNER_ID, USER_ID]);
    mockCommunityMemberFindMany.mockResolvedValue([
      { userId: OWNER_ID },
      { userId: USER_ID },
    ] as any);
    mockCommunityMemberDeleteMany.mockResolvedValue({} as any);

    const result = await removeMember(
      COMMUNITY_SLUG,
      USER_ID,
      null,
      new FormData(),
    );

    expect(mockCommunityMemberDeleteMany).toHaveBeenCalledWith({
      where: {
        communityId: COMMUNITY_ID,
        userId: { in: [USER_ID] },
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
      error: "You are not authorized to modify this community.",
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
    expect(mockCommunityUpsert).not.toHaveBeenCalled();
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
      error: "You are not authorized to modify this community.",
    });
    expect(mockCommunityUpsert).not.toHaveBeenCalled();
  });

  it("updates invite token and returns success for owner", async () => {
    mockSession(OWNER_ID);
    mockCommunity();
    mockCommunityUpsert.mockResolvedValue({} as never);
    mockCommunityMemberFindMany.mockResolvedValue([]);

    const result = await regenerateInviteToken(
      COMMUNITY_SLUG,
      null,
      new FormData(),
    );

    const call = mockCommunityUpsert.mock.calls[0][0];
    const token = call.update.inviteToken as string;
    expect(call.where).toEqual({ id: COMMUNITY_ID });
    expect(token).toBeTruthy();
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(16);
    expect(result).toEqual({ success: true });
  });
});
