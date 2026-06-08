import { describe, expect, it, vi } from "vitest";
import { Bet } from "../domain/bet";
import { PrismaBetRepository } from "./prisma-bet-repository";

const ROW = {
  id: "bet-1",
  userId: "user-1",
  label: "My bet",
  status: "draft",
  groupPredictions: { groupOrders: { A: ["mex"] }, thirdPlaceOrder: ["3rd-a"] },
  knockoutWinners: { "R32-73": "mex" },
  createdAt: new Date(),
  updatedAt: new Date(),
};

function fakePrisma() {
  return {
    bet: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
  };
}

describe("PrismaBetRepository.findById", () => {
  it("maps a row into a Bet aggregate", async () => {
    const prisma = fakePrisma();
    prisma.bet.findUnique.mockResolvedValue(ROW);
    const repo = new PrismaBetRepository(prisma as never);

    const bet = await repo.findById("bet-1");

    expect(bet?.toState()).toEqual({
      id: "bet-1",
      userId: "user-1",
      label: "My bet",
      status: "draft",
      groupPredictions: ROW.groupPredictions,
      knockoutWinners: ROW.knockoutWinners,
    });
  });

  it("rehydrates null knockoutWinners into an empty map", async () => {
    const prisma = fakePrisma();
    prisma.bet.findUnique.mockResolvedValue({
      ...ROW,
      groupPredictions: null,
      knockoutWinners: null,
    });
    const repo = new PrismaBetRepository(prisma as never);

    const bet = await repo.findById("bet-1");

    expect(bet?.toState().knockoutWinners).toEqual({});
    expect(bet?.toState().groupPredictions).toBeNull();
  });

  it("returns null when the row is absent", async () => {
    const prisma = fakePrisma();
    prisma.bet.findUnique.mockResolvedValue(null);
    const repo = new PrismaBetRepository(prisma as never);

    expect(await repo.findById("missing")).toBeNull();
  });
});

describe("PrismaBetRepository.save", () => {
  it("round-trips an aggregate back to its row columns", async () => {
    const prisma = fakePrisma();
    const repo = new PrismaBetRepository(prisma as never);
    const bet = Bet.fromState({
      id: "bet-1",
      userId: "user-1",
      label: "My bet",
      status: "closed",
      groupPredictions: ROW.groupPredictions,
      knockoutWinners: ROW.knockoutWinners,
    });

    const result = await repo.save(bet);

    expect(result.isOk()).toBe(true);
    expect(prisma.bet.update).toHaveBeenCalledWith({
      where: { id: "bet-1" },
      data: {
        label: "My bet",
        status: "closed",
        groupPredictions: ROW.groupPredictions,
        knockoutWinners: ROW.knockoutWinners,
      },
    });
  });
});
