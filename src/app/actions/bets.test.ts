import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next-intl/server", () => ({
  getLocale: vi.fn().mockResolvedValue("en"),
  // Mirrors messages/en.json "betErrors": maps stable codes to the legacy
  // English strings so the migrated closeBet contract stays observable here.
  getTranslations: vi.fn(
    async () =>
      (key: string): string =>
        (
          ({
            NOT_FOUND: "Bet not found",
            FORBIDDEN: "Not authorized",
            PAST_DEADLINE: "Deadline has passed",
            INCOMPLETE_PREDICTIONS: "Predictions are incomplete",
            INVALID_LABEL: "Label is invalid",
            BET_CLOSED: "Bet is closed",
          }) as Record<string, string>
        )[key] ?? key,
  ),
}));
vi.mock("@/i18n/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/bet-constants", () => ({
  BET_DEADLINE: new Date("2026-06-11T19:00:00Z"),
  MAX_BETS_PER_USER: 3,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    bet: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  },
}));
vi.mock("@/lib/session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/bet-constants", () => ({
  BET_DEADLINE: new Date("2026-06-11T19:00:00Z"),
  MAX_BETS_PER_USER: 3,
}));

import { redirect } from "@/i18n/navigation";
import type { TournamentState } from "@/lib/prediction-state";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import {
  closeBet,
  copyBet,
  createBet,
  removeBet,
  renameBet,
  reopenBet,
  updateBetPredictions,
} from "./bets";

const mockGetSession = vi.mocked(getSession);
const mockRedirect = vi.mocked(redirect);
const mockCreate = vi.mocked(prisma.bet.create);
const mockFindUnique = vi.mocked(prisma.bet.findUnique);
const mockUpdate = vi.mocked(prisma.bet.update);
const mockDelete = vi.mocked(prisma.bet.delete);
const mockCount = vi.mocked(prisma.bet.count);

function mockSession(userId = OWNER_ID) {
  mockGetSession.mockResolvedValue({ user: { id: userId } } as Awaited<
    ReturnType<typeof getSession>
  >);
}

function mockBet(overrides: Record<string, unknown> = {}) {
  mockFindUnique.mockResolvedValue({
    id: BET_ID,
    userId: OWNER_ID,
    status: "draft",
    label: "x",
    createdAt: new Date(),
    updatedAt: new Date(),
    groupPredictions: null,
    knockoutWinners: null,
    ...overrides,
  } as Awaited<ReturnType<typeof mockFindUnique>>);
}

const OWNER_ID = "user-1";
const BET_ID = "bet-1";
const VALID_STATE: TournamentState = {
  groupOrders: { A: ["mex", "rsa", "kor", "cze"] },
  thirdPlaceOrder: ["3rd-a"],
  knockoutMatches: {
    "R32-1": {
      id: "R32-1",
      round: "R32",
      team1Id: "mex",
      team2Id: null,
      winnerId: null,
      loserId: null,
    },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createBet", () => {
  it("returns error when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    const fd = new FormData();
    fd.append("label", "My bet");
    const result = await createBet(null, fd);
    expect(result).toEqual({ error: "Not authenticated" });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("returns error when label missing", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T00:00:00Z"));
    try {
      mockGetSession.mockResolvedValue({ user: { id: OWNER_ID } } as Awaited<
        ReturnType<typeof getSession>
      >);
      const fd = new FormData();
      const result = await createBet(null, fd);
      expect(result).toEqual({ error: "Label is required" });
      expect(mockCreate).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("redirects to /bets/[id] after successful creation", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T00:00:00Z"));
    try {
      mockGetSession.mockResolvedValue({ user: { id: OWNER_ID } } as Awaited<
        ReturnType<typeof getSession>
      >);
      mockCount.mockResolvedValue(0);
      mockCreate.mockResolvedValue({
        id: BET_ID,
        label: "My bet",
        userId: OWNER_ID,
      } as Awaited<ReturnType<typeof mockCreate>>);
      const fd = new FormData();
      fd.append("label", "My bet");
      await createBet(null, fd);
      expect(mockCreate).toHaveBeenCalledWith({
        data: { label: "My bet", userId: OWNER_ID },
      });
      expect(mockRedirect).toHaveBeenCalledWith({
        href: `/bets/${BET_ID}`,
        locale: "en",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns error when deadline has passed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-12T00:00:00Z"));
    try {
      mockGetSession.mockResolvedValue({ user: { id: OWNER_ID } } as Awaited<
        ReturnType<typeof getSession>
      >);
      const fd = new FormData();
      fd.append("label", "My bet");
      const result = await createBet(null, fd);
      expect(result).toEqual({ error: "Deadline passed" });
      expect(mockCreate).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns error when bet limit reached", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T00:00:00Z"));
    try {
      mockGetSession.mockResolvedValue({ user: { id: OWNER_ID } } as Awaited<
        ReturnType<typeof getSession>
      >);
      mockCount.mockResolvedValue(3);
      const fd = new FormData();
      fd.append("label", "My bet");
      const result = await createBet(null, fd);
      expect(result).toEqual({ error: "Bet limit reached" });
      expect(mockCreate).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("removeBet", () => {
  const BEFORE_DEADLINE = new Date("2026-06-10T00:00:00Z");
  const AFTER_DEADLINE = new Date("2026-06-12T00:00:00Z");

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns error when not authenticated", async () => {
    vi.setSystemTime(BEFORE_DEADLINE);
    mockGetSession.mockResolvedValue(null);
    const result = await removeBet(BET_ID);
    expect(result).toEqual({ error: "Not authenticated" });
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("returns error when bet not found", async () => {
    vi.setSystemTime(BEFORE_DEADLINE);
    mockGetSession.mockResolvedValue({ user: { id: OWNER_ID } } as Awaited<
      ReturnType<typeof getSession>
    >);
    mockFindUnique.mockResolvedValue(null);
    const result = await removeBet(BET_ID);
    expect(result).toEqual({ error: "Bet not found" });
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("returns error when caller does not own the bet", async () => {
    vi.setSystemTime(BEFORE_DEADLINE);
    mockGetSession.mockResolvedValue({
      user: { id: "other-user" },
    } as Awaited<ReturnType<typeof getSession>>);
    mockFindUnique.mockResolvedValue({
      id: BET_ID,
      userId: OWNER_ID,
    } as Awaited<ReturnType<typeof mockFindUnique>>);
    const result = await removeBet(BET_ID);
    expect(result).toEqual({ error: "Not authorized" });
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("returns error when admin user does not own the bet", async () => {
    vi.setSystemTime(BEFORE_DEADLINE);
    mockGetSession.mockResolvedValue({
      user: { id: "admin-user", role: "admin" },
    } as Awaited<ReturnType<typeof getSession>>);
    mockFindUnique.mockResolvedValue({
      id: BET_ID,
      userId: OWNER_ID,
    } as Awaited<ReturnType<typeof mockFindUnique>>);
    const result = await removeBet(BET_ID);
    expect(result).toEqual({ error: "Not authorized" });
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("returns error when called after deadline", async () => {
    vi.setSystemTime(AFTER_DEADLINE);
    mockGetSession.mockResolvedValue({ user: { id: OWNER_ID } } as Awaited<
      ReturnType<typeof getSession>
    >);
    mockFindUnique.mockResolvedValue({
      id: BET_ID,
      userId: OWNER_ID,
    } as Awaited<ReturnType<typeof mockFindUnique>>);
    const result = await removeBet(BET_ID);
    expect(result).toEqual({ error: "Deadline has passed" });
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("deletes bet and returns success on happy path", async () => {
    vi.setSystemTime(BEFORE_DEADLINE);
    mockGetSession.mockResolvedValue({ user: { id: OWNER_ID } } as Awaited<
      ReturnType<typeof getSession>
    >);
    mockFindUnique.mockResolvedValue({
      id: BET_ID,
      userId: OWNER_ID,
    } as Awaited<ReturnType<typeof mockFindUnique>>);
    mockDelete.mockResolvedValue({} as Awaited<ReturnType<typeof mockDelete>>);
    const result = await removeBet(BET_ID);
    expect(result).toEqual({ success: true });
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: BET_ID } });
  });
});

describe("updateBetPredictions", () => {
  it("returns error when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    const result = await updateBetPredictions(BET_ID, VALID_STATE);
    expect(result).toEqual({ error: "Not authenticated" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns error when bet not found", async () => {
    mockSession();
    mockFindUnique.mockResolvedValue(null);
    const result = await updateBetPredictions(BET_ID, VALID_STATE);
    expect(result).toEqual({ error: "Bet not found" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns error when caller does not own the bet", async () => {
    mockSession("other-user");
    mockBet();
    const result = await updateBetPredictions(BET_ID, VALID_STATE);
    expect(result).toEqual({ error: "Not authorized" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns error when admin user does not own the bet", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "admin-user", role: "admin" },
    } as Awaited<ReturnType<typeof getSession>>);
    mockBet();
    const result = await updateBetPredictions(BET_ID, VALID_STATE);
    expect(result).toEqual({ error: "Not authorized" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns error when bet is closed", async () => {
    mockSession();
    mockBet({ status: "closed" });
    const result = await updateBetPredictions(BET_ID, VALID_STATE);
    expect(result).toEqual({ error: "Bet is closed" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns error when deadline has passed (regression: post-deadline edit bug)", async () => {
    const { BET_DEADLINE } = await import("@/lib/bet-constants");
    vi.spyOn(BET_DEADLINE, "getTime").mockReturnValue(Date.now() - 1000);
    mockSession();
    mockBet();
    const result = await updateBetPredictions(BET_ID, VALID_STATE);
    expect(result).toEqual({ error: "Deadline has passed" });
    expect(mockUpdate).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("persists only group predictions (strips knockout matches) and returns success", async () => {
    mockSession();
    mockBet();
    mockUpdate.mockResolvedValue({
      id: BET_ID,
      userId: OWNER_ID,
      label: "x",
      status: "draft",
      createdAt: new Date(),
      updatedAt: new Date(),
      groupPredictions: {
        groupOrders: VALID_STATE.groupOrders,
        thirdPlaceOrder: VALID_STATE.thirdPlaceOrder,
      },
      knockoutWinners: null,
    } as Awaited<ReturnType<typeof mockUpdate>>);
    const result = await updateBetPredictions(BET_ID, VALID_STATE);
    expect(result).toEqual({ success: true });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: BET_ID },
      data: expect.objectContaining({
        groupPredictions: {
          groupOrders: VALID_STATE.groupOrders,
          thirdPlaceOrder: VALID_STATE.thirdPlaceOrder,
        },
        knockoutWinners: expect.any(Object),
      }),
    });
  });
});

describe("closeBet", () => {
  it("returns error when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    const result = await closeBet(BET_ID);
    expect(result).toEqual({ error: "Not authenticated" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns error when bet not found", async () => {
    mockSession();
    mockFindUnique.mockResolvedValue(null);
    const result = await closeBet(BET_ID);
    expect(result).toEqual({ error: "Bet not found" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns error when caller does not own the bet", async () => {
    mockSession("other-user");
    mockBet();
    const result = await closeBet(BET_ID);
    expect(result).toEqual({ error: "Not authorized" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns error when admin user does not own the bet", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "admin-user", role: "admin" },
    } as Awaited<ReturnType<typeof getSession>>);
    mockBet();
    const result = await closeBet(BET_ID);
    expect(result).toEqual({ error: "Not authorized" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns error when deadline has passed", async () => {
    const { BET_DEADLINE } = await import("@/lib/bet-constants");
    vi.spyOn(BET_DEADLINE, "getTime").mockReturnValue(Date.now() - 1000);
    mockSession();
    mockBet();
    const result = await closeBet(BET_ID);
    expect(result).toEqual({ error: "Deadline has passed" });
    expect(mockUpdate).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("returns error when predictions are incomplete", async () => {
    mockSession();
    mockBet({ knockoutWinners: { "R32-1": "mex" } });
    const result = await closeBet(BET_ID);
    expect(result).toEqual({ error: "Predictions are incomplete" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("sets status to closed and returns success", async () => {
    mockSession();
    const completeWinners = Object.fromEntries(
      Array.from({ length: 32 }, (_, i) => [`M${i}`, `team-${i}`]),
    );
    mockBet({ knockoutWinners: completeWinners });
    mockUpdate.mockResolvedValue({} as Awaited<ReturnType<typeof mockUpdate>>);
    const result = await closeBet(BET_ID);
    expect(result).toEqual({ success: true });
    // Persistence now flows through PrismaBetRepository.save, which writes the
    // full aggregate; the close path is observable via status: "closed".
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: BET_ID },
      data: expect.objectContaining({ status: "closed" }),
    });
  });
});

describe("reopenBet", () => {
  it("returns error when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    const result = await reopenBet(BET_ID);
    expect(result).toEqual({ error: "Not authenticated" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns error when bet not found", async () => {
    mockSession();
    mockFindUnique.mockResolvedValue(null);
    const result = await reopenBet(BET_ID);
    expect(result).toEqual({ error: "Bet not found" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns error when caller does not own the bet", async () => {
    mockSession("other-user");
    mockBet();
    const result = await reopenBet(BET_ID);
    expect(result).toEqual({ error: "Not authorized" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns error when admin user does not own the bet", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "admin-user", role: "admin" },
    } as Awaited<ReturnType<typeof getSession>>);
    mockBet();
    const result = await reopenBet(BET_ID);
    expect(result).toEqual({ error: "Not authorized" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns error when deadline has passed", async () => {
    const { BET_DEADLINE } = await import("@/lib/bet-constants");
    vi.spyOn(BET_DEADLINE, "getTime").mockReturnValue(Date.now() - 1000);
    mockSession();
    mockBet({ status: "closed" });
    const result = await reopenBet(BET_ID);
    expect(result).toEqual({ error: "Deadline has passed" });
    expect(mockUpdate).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("sets status to draft and returns success", async () => {
    mockSession();
    mockBet({ status: "closed" });
    mockUpdate.mockResolvedValue({} as Awaited<ReturnType<typeof mockUpdate>>);
    const result = await reopenBet(BET_ID);
    expect(result).toEqual({ success: true });
    // Persistence now flows through PrismaBetRepository.save, which writes the
    // full aggregate; the reopen path is observable via status: "draft".
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: BET_ID },
      data: expect.objectContaining({ status: "draft" }),
    });
  });
});

describe("copyBet", () => {
  const SOURCE_BET = {
    id: BET_ID,
    userId: OWNER_ID,
    label: "My Bet",
    status: "draft",
    createdAt: new Date(),
    updatedAt: new Date(),
    groupPredictions: {
      groupOrders: VALID_STATE.groupOrders,
      thirdPlaceOrder: VALID_STATE.thirdPlaceOrder,
    },
    knockoutWinners: { "R32-1": "mex" },
  };
  const NEW_BET_ID = "bet-2";

  it("returns error when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    const result = await copyBet(BET_ID);
    expect(result).toEqual({ error: "Not authenticated" });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("returns error when source bet not found", async () => {
    mockGetSession.mockResolvedValue({ user: { id: OWNER_ID } } as Awaited<
      ReturnType<typeof getSession>
    >);
    mockFindUnique.mockResolvedValue(null);
    const result = await copyBet(BET_ID);
    expect(result).toEqual({ error: "Bet not found" });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("returns error when caller does not own the source bet", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "other-user" } } as Awaited<
      ReturnType<typeof getSession>
    >);
    mockFindUnique.mockResolvedValue(
      SOURCE_BET as Awaited<ReturnType<typeof mockFindUnique>>,
    );
    const result = await copyBet(BET_ID);
    expect(result).toEqual({ error: "Not authorized" });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("returns error when admin user does not own the source bet", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "admin-user", role: "admin" },
    } as Awaited<ReturnType<typeof getSession>>);
    mockFindUnique.mockResolvedValue(
      SOURCE_BET as Awaited<ReturnType<typeof mockFindUnique>>,
    );
    const result = await copyBet(BET_ID);
    expect(result).toEqual({ error: "Not authorized" });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("returns error when deadline has passed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-12T00:00:00Z"));
    mockGetSession.mockResolvedValue({ user: { id: OWNER_ID } } as Awaited<
      ReturnType<typeof getSession>
    >);
    mockFindUnique.mockResolvedValue(
      SOURCE_BET as Awaited<ReturnType<typeof mockFindUnique>>,
    );
    const result = await copyBet(BET_ID);
    expect(result).toEqual({ error: "Bet deadline has passed" });
    expect(mockCreate).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("returns error when user is at the bet limit", async () => {
    mockGetSession.mockResolvedValue({ user: { id: OWNER_ID } } as Awaited<
      ReturnType<typeof getSession>
    >);
    mockFindUnique.mockResolvedValue(
      SOURCE_BET as Awaited<ReturnType<typeof mockFindUnique>>,
    );
    mockCount.mockResolvedValue(3);
    const result = await copyBet(BET_ID);
    expect(result).toEqual({ error: "Bet limit reached" });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("creates a new draft bet with copied predictions and 'Copy of ' label prefix", async () => {
    mockGetSession.mockResolvedValue({ user: { id: OWNER_ID } } as Awaited<
      ReturnType<typeof getSession>
    >);
    mockFindUnique.mockResolvedValue(
      SOURCE_BET as Awaited<ReturnType<typeof mockFindUnique>>,
    );
    mockCount.mockResolvedValue(1);
    mockCreate.mockResolvedValue({
      ...SOURCE_BET,
      id: NEW_BET_ID,
      label: "Copy of My Bet",
    } as Awaited<ReturnType<typeof mockCreate>>);
    await copyBet(BET_ID);
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        label: "Copy of My Bet",
        userId: OWNER_ID,
        status: "draft",
        groupPredictions: SOURCE_BET.groupPredictions,
        knockoutWinners: SOURCE_BET.knockoutWinners,
      },
    });
    expect(mockRedirect).toHaveBeenCalledWith({
      href: `/bets/${NEW_BET_ID}`,
      locale: "en",
    });
  });

  it("truncates label to 200 characters when prefixed label exceeds limit", async () => {
    const longLabel = "A".repeat(197);
    mockGetSession.mockResolvedValue({ user: { id: OWNER_ID } } as Awaited<
      ReturnType<typeof getSession>
    >);
    mockFindUnique.mockResolvedValue({
      ...SOURCE_BET,
      label: longLabel,
    } as Awaited<ReturnType<typeof mockFindUnique>>);
    mockCount.mockResolvedValue(0);
    mockCreate.mockResolvedValue({
      ...SOURCE_BET,
      id: NEW_BET_ID,
      label: `Copy of ${longLabel}`.slice(0, 200),
    } as Awaited<ReturnType<typeof mockCreate>>);
    await copyBet(BET_ID);
    const createCall = mockCreate.mock.calls[0][0];
    expect(createCall.data.label.length).toBe(200);
    expect(createCall.data.label).toBe(`Copy of ${longLabel}`.slice(0, 200));
  });

  it("revalidates /bets path on success", async () => {
    const { revalidatePath } = await import("next/cache");
    const mockRevalidate = vi.mocked(revalidatePath);
    mockGetSession.mockResolvedValue({ user: { id: OWNER_ID } } as Awaited<
      ReturnType<typeof getSession>
    >);
    mockFindUnique.mockResolvedValue(
      SOURCE_BET as Awaited<ReturnType<typeof mockFindUnique>>,
    );
    mockCount.mockResolvedValue(0);
    mockCreate.mockResolvedValue({
      ...SOURCE_BET,
      id: NEW_BET_ID,
    } as Awaited<ReturnType<typeof mockCreate>>);
    await copyBet(BET_ID);
    expect(mockRevalidate).toHaveBeenCalledWith("/bets");
  });
});

describe("renameBet", () => {
  it("returns error when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    const result = await renameBet(BET_ID, "New label");
    expect(result).toEqual({ error: "Not authenticated" });
  });

  it("returns error when label is empty or only whitespace", async () => {
    mockSession();
    mockBet();
    const result1 = await renameBet(BET_ID, "");
    expect(result1).toEqual({ error: "Label is invalid" });

    const result2 = await renameBet(BET_ID, "   ");
    expect(result2).toEqual({ error: "Label is invalid" });
  });

  it("returns error when label is too long (> 200 characters)", async () => {
    mockSession();
    mockBet();
    const result = await renameBet(BET_ID, "a".repeat(201));
    expect(result).toEqual({ error: "Label is invalid" });
  });

  it("returns error when bet not found", async () => {
    mockSession();
    mockFindUnique.mockResolvedValue(null);
    const result = await renameBet(BET_ID, "New label");
    expect(result).toEqual({ error: "Bet not found" });
  });

  it("returns error when caller does not own the bet", async () => {
    mockSession("other-user");
    mockBet();
    const result = await renameBet(BET_ID, "New label");
    expect(result).toEqual({ error: "Not authorized" });
  });

  it("returns error when bet status is closed", async () => {
    mockSession();
    mockBet({ status: "closed" });
    const result = await renameBet(BET_ID, "New label");
    expect(result).toEqual({ error: "Bet is closed" });
  });

  it("returns error when deadline has passed", async () => {
    mockSession();
    mockBet();
    const { BET_DEADLINE } = await import("@/lib/bet-constants");
    vi.spyOn(BET_DEADLINE, "getTime").mockReturnValue(Date.now() - 1000);
    try {
      const result = await renameBet(BET_ID, "New label");
      expect(result).toEqual({ error: "Deadline has passed" });
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("updates the label and returns success on success path", async () => {
    mockSession();
    mockBet();
    mockUpdate.mockResolvedValue({} as Awaited<ReturnType<typeof mockUpdate>>);
    const { revalidatePath } = await import("next/cache");
    const mockRevalidate = vi.mocked(revalidatePath);

    const result = await renameBet(BET_ID, "New label");

    expect(result).toEqual({ success: true });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: BET_ID },
      data: {
        label: "New label",
        status: "draft",
        groupPredictions: undefined,
        knockoutWinners: {},
      },
    });
    expect(mockRevalidate).toHaveBeenCalledWith(`/bets/${BET_ID}`);
    expect(mockRevalidate).toHaveBeenCalledWith("/bets");
  });
});
