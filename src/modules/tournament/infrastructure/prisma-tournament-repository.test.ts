import { describe, expect, it, vi } from "vitest";
import { Tournament } from "../domain/tournament";
import { PrismaTournamentRepository } from "./prisma-tournament-repository";

const ROW = {
  id: "singleton",
  result: {
    groupOrders: { A: ["usa", "wal"] },
    thirdPlaceOrder: ["3rd-a"],
    knockoutWinners: { "R32-73": "usa" },
  },
  advancement: ["1A", "2A", "3rd-1E"],
  createdAt: new Date(),
  updatedAt: new Date(),
};

function fakePrisma() {
  return {
    tournament: {
      findUnique: vi.fn(),
      upsert: vi.fn().mockResolvedValue({}),
    },
  };
}

describe("PrismaTournamentRepository.get", () => {
  it("maps a row into a Tournament aggregate", async () => {
    const prisma = fakePrisma();
    prisma.tournament.findUnique.mockResolvedValue(ROW);
    const repo = new PrismaTournamentRepository(prisma as never);

    const t = await repo.get();

    expect(t?.toState()).toEqual({
      id: "singleton",
      result: ROW.result,
      advancement: ROW.advancement,
      createdAt: ROW.createdAt,
      updatedAt: ROW.updatedAt,
    });
    expect(prisma.tournament.findUnique).toHaveBeenCalledWith({
      where: { id: "singleton" },
    });
  });

  it("rehydrates null result and advancement into defaults", async () => {
    const prisma = fakePrisma();
    prisma.tournament.findUnique.mockResolvedValue({
      ...ROW,
      result: null,
      advancement: null,
    });
    const repo = new PrismaTournamentRepository(prisma as never);

    const t = await repo.get();

    expect(t?.result).toBeNull();
    expect(t?.advancement).toEqual([]);
  });

  it("returns null when the row is absent", async () => {
    const prisma = fakePrisma();
    prisma.tournament.findUnique.mockResolvedValue(null);
    const repo = new PrismaTournamentRepository(prisma as never);

    expect(await repo.get()).toBeNull();
  });
});

describe("PrismaTournamentRepository.save", () => {
  it("round-trips an aggregate back to its row columns via upsert", async () => {
    const prisma = fakePrisma();
    const repo = new PrismaTournamentRepository(prisma as never);
    const t = Tournament.fromState({
      id: "singleton",
      result: ROW.result,
      advancement: ROW.advancement,
    });

    const result = await repo.save(t);

    expect(result.isOk()).toBe(true);
    expect(prisma.tournament.upsert).toHaveBeenCalledWith({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        result: ROW.result,
        advancement: ROW.advancement,
      },
      update: {
        result: ROW.result,
        advancement: ROW.advancement,
      },
    });
  });

  it("maps any persistence failure to SAVE_FAILED", async () => {
    const prisma = fakePrisma();
    prisma.tournament.upsert.mockRejectedValue(new Error("db down"));
    const repo = new PrismaTournamentRepository(prisma as never);
    const t = Tournament.createDefault();

    const result = await repo.save(t);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("SAVE_FAILED");
  });
});
