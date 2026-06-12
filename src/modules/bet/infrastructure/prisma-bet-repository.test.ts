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
  directPredictions: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function fakePrisma() {
  return {
    bet: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      upsert: vi.fn().mockResolvedValue({}),
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
      directPredictions: null,
      createdAt: ROW.createdAt,
      updatedAt: ROW.updatedAt,
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

  it("maps a row with directPredictions into a Direct Bet aggregate", async () => {
    const prisma = fakePrisma();
    const directRow = {
      ...ROW,
      groupPredictions: null,
      knockoutWinners: null,
      directPredictions: {
        R32: ["usa"],
        R16: ["usa"],
        QF: ["usa"],
        SF: ["usa"],
        F: ["usa"],
        champion: "usa",
        thirdPlace: "usa",
      },
    };
    prisma.bet.findUnique.mockResolvedValue(directRow);
    const repo = new PrismaBetRepository(prisma as never);

    const bet = await repo.findById("bet-1");

    expect(bet?.toState()).toEqual({
      id: "bet-1",
      userId: "user-1",
      label: "My bet",
      status: "draft",
      groupPredictions: null,
      knockoutWinners: {},
      directPredictions: directRow.directPredictions,
      createdAt: ROW.createdAt,
      updatedAt: ROW.updatedAt,
    });
  });
});

describe("PrismaBetRepository.listByOwner", () => {
  it("maps database rows into Bet aggregates", async () => {
    const prisma = fakePrisma();
    prisma.bet.findMany.mockResolvedValue([ROW]);
    const repo = new PrismaBetRepository(prisma as never);

    const bets = await repo.listByOwner("user-1");

    expect(bets).toHaveLength(1);
    expect(bets[0].toState()).toEqual({
      id: "bet-1",
      userId: "user-1",
      label: "My bet",
      status: "draft",
      groupPredictions: ROW.groupPredictions,
      knockoutWinners: ROW.knockoutWinners,
      directPredictions: null,
      createdAt: ROW.createdAt,
      updatedAt: ROW.updatedAt,
    });
    expect(prisma.bet.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: { createdAt: "desc" },
    });
  });
});

describe("PrismaBetRepository.listByOwners", () => {
  it("maps database rows for multiple owners", async () => {
    const prisma = fakePrisma();
    prisma.bet.findMany.mockResolvedValue([ROW]);
    const repo = new PrismaBetRepository(prisma as never);

    const bets = await repo.listByOwners(["user-1", "user-2"]);

    expect(bets).toHaveLength(1);
    expect(prisma.bet.findMany).toHaveBeenCalledWith({
      where: { userId: { in: ["user-1", "user-2"] } },
      orderBy: { createdAt: "desc" },
    });
  });
});

describe("PrismaBetRepository.countByOwner", () => {
  it("returns the number of bets for a user", async () => {
    const prisma = fakePrisma();
    prisma.bet.count.mockResolvedValue(5);
    const repo = new PrismaBetRepository(prisma as never);

    const count = await repo.countByOwner("user-1");

    expect(count).toBe(5);
    expect(prisma.bet.count).toHaveBeenCalledWith({
      where: { userId: "user-1" },
    });
  });
});

describe("PrismaBetRepository.save", () => {
  it("round-trips an aggregate back to its row columns via upsert", async () => {
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
    expect(prisma.bet.upsert).toHaveBeenCalledWith({
      where: { id: "bet-1" },
      create: {
        id: "bet-1",
        userId: "user-1",
        label: "My bet",
        status: "closed",
        groupPredictions: ROW.groupPredictions,
        knockoutWinners: ROW.knockoutWinners,
      },
      update: {
        label: "My bet",
        status: "closed",
        groupPredictions: ROW.groupPredictions,
        knockoutWinners: ROW.knockoutWinners,
      },
    });
  });

  function bet() {
    return Bet.fromState({
      id: "bet-1",
      userId: "user-1",
      label: "My bet",
      status: "closed",
      groupPredictions: ROW.groupPredictions,
      knockoutWinners: ROW.knockoutWinners,
    });
  }

  it("maps any persistence failure to SAVE_FAILED", async () => {
    const prisma = fakePrisma();
    prisma.bet.upsert.mockRejectedValue(new Error("connection reset"));
    const repo = new PrismaBetRepository(prisma as never);

    const result = await repo.save(bet());

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("SAVE_FAILED");
  });

  it("saves a Direct Bet with directPredictions intact and groupPredictions null", async () => {
    const prisma = fakePrisma();
    const repo = new PrismaBetRepository(prisma as never);
    const preds = {
      R32: ["usa"],
      R16: ["usa"],
      QF: ["usa"],
      SF: ["usa"],
      F: ["usa"],
      champion: "usa",
      thirdPlace: "usa",
    };
    const bet = Bet.fromState({
      id: "bet-1",
      userId: "user-1",
      label: "Direct Bet",
      status: "closed",
      groupPredictions: null,
      knockoutWinners: {},
      directPredictions: preds,
    });

    const result = await repo.save(bet);

    expect(result.isOk()).toBe(true);
    expect(prisma.bet.upsert).toHaveBeenCalledWith({
      where: { id: "bet-1" },
      create: {
        id: "bet-1",
        userId: "user-1",
        label: "Direct Bet",
        status: "closed",
        groupPredictions: undefined,
        knockoutWinners: {},
        directPredictions: preds,
      },
      update: {
        label: "Direct Bet",
        status: "closed",
        groupPredictions: undefined,
        knockoutWinners: {},
        directPredictions: preds,
      },
    });
  });
});
