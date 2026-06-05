import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    bet: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));
vi.mock("@/lib/session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/bet-constants", () => ({
  BET_DEADLINE: new Date("2026-06-11T19:00:00Z"),
  MAX_BETS_PER_USER: 3,
}));

import { redirect } from "next/navigation";
import type { TournamentState } from "@/lib/prediction-state";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { createBet, removeBet, updateBetPredictions } from "./bets";

const mockGetSession = vi.mocked(getSession);
const mockRedirect = vi.mocked(redirect);
const mockCreate = vi.mocked(prisma.bet.create);
const mockFindUnique = vi.mocked(prisma.bet.findUnique);
const mockUpdate = vi.mocked(prisma.bet.update);
const mockDelete = vi.mocked(prisma.bet.delete);

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
    mockGetSession.mockResolvedValue({ user: { id: OWNER_ID } } as Awaited<
      ReturnType<typeof getSession>
    >);
    const fd = new FormData();
    const result = await createBet(null, fd);
    expect(result).toEqual({ error: "Label is required" });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("redirects to /bets/[id] after successful creation", async () => {
    mockGetSession.mockResolvedValue({ user: { id: OWNER_ID } } as Awaited<
      ReturnType<typeof getSession>
    >);
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
    expect(mockRedirect).toHaveBeenCalledWith(`/bets/${BET_ID}`);
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
    expect(result).toEqual({ error: "Not found" });
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
    expect(result).toEqual({ error: "Deadline passed" });
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
    mockGetSession.mockResolvedValue({ user: { id: OWNER_ID } } as Awaited<
      ReturnType<typeof getSession>
    >);
    mockFindUnique.mockResolvedValue(null);
    const result = await updateBetPredictions(BET_ID, VALID_STATE);
    expect(result).toEqual({ error: "Bet not found" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns error when caller does not own the bet", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "other-user" } } as Awaited<
      ReturnType<typeof getSession>
    >);
    mockFindUnique.mockResolvedValue({
      id: BET_ID,
      userId: OWNER_ID,
    } as Awaited<ReturnType<typeof mockFindUnique>>);
    const result = await updateBetPredictions(BET_ID, VALID_STATE);
    expect(result).toEqual({ error: "Not authorized" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("persists only group predictions (strips knockout matches) and returns success", async () => {
    mockGetSession.mockResolvedValue({ user: { id: OWNER_ID } } as Awaited<
      ReturnType<typeof getSession>
    >);
    mockFindUnique.mockResolvedValue({
      id: BET_ID,
      userId: OWNER_ID,
    } as Awaited<ReturnType<typeof mockFindUnique>>);
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
