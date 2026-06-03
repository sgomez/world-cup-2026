import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { bet: { findUnique: vi.fn(), update: vi.fn() } } }));
vi.mock("@/lib/session", () => ({ getSession: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { type PredictionState, updateBetPredictions } from "./bets";

const mockGetSession = vi.mocked(getSession);
const mockFindUnique = vi.mocked(prisma.bet.findUnique);
const mockUpdate = vi.mocked(prisma.bet.update);

const OWNER_ID = "user-1";
const BET_ID = "bet-1";
const VALID_STATE: PredictionState = {
  groupOrders: { A: ["mex", "rsa", "kor", "cze"] },
  thirdPlaceOrder: ["3rd-a"],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("updateBetPredictions", () => {
  it("returns error when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    const result = await updateBetPredictions(BET_ID, VALID_STATE);
    expect(result).toEqual({ error: "Not authenticated" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns error when bet not found", async () => {
    mockGetSession.mockResolvedValue({ user: { id: OWNER_ID } } as Awaited<ReturnType<typeof getSession>>);
    mockFindUnique.mockResolvedValue(null);
    const result = await updateBetPredictions(BET_ID, VALID_STATE);
    expect(result).toEqual({ error: "Bet not found" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns error when caller does not own the bet", async () => {
    mockGetSession.mockResolvedValue({ user: { id: "other-user" } } as Awaited<ReturnType<typeof getSession>>);
    mockFindUnique.mockResolvedValue({ id: BET_ID, userId: OWNER_ID } as Awaited<ReturnType<typeof mockFindUnique>>);
    const result = await updateBetPredictions(BET_ID, VALID_STATE);
    expect(result).toEqual({ error: "Not authorized" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("persists prediction state and returns success when owner calls", async () => {
    mockGetSession.mockResolvedValue({ user: { id: OWNER_ID } } as Awaited<ReturnType<typeof getSession>>);
    mockFindUnique.mockResolvedValue({ id: BET_ID, userId: OWNER_ID } as Awaited<ReturnType<typeof mockFindUnique>>);
    mockUpdate.mockResolvedValue({ id: BET_ID, userId: OWNER_ID, groupPredictions: VALID_STATE } as Awaited<ReturnType<typeof mockUpdate>>);
    const result = await updateBetPredictions(BET_ID, VALID_STATE);
    expect(result).toEqual({ success: true });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: BET_ID },
      data: { groupPredictions: VALID_STATE },
    });
  });
});
