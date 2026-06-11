import { describe, expect, it, vi } from "vitest";
import { Tournament } from "../domain/tournament";
import { PrismaTournamentRepository } from "./prisma-tournament-repository";

const ROW = {
  id: "singleton",
  manualTieBreaks: { A: ["mex", "kor"] },
  thirdPlaceManualOrder: ["mex", "bra"],
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
      manualTieBreaks: ROW.manualTieBreaks,
      thirdPlaceManualOrder: ROW.thirdPlaceManualOrder,
      createdAt: ROW.createdAt,
      updatedAt: ROW.updatedAt,
    });
    expect(prisma.tournament.findUnique).toHaveBeenCalledWith({
      where: { id: "singleton" },
    });
  });

  it("rehydrates null manualTieBreaks and thirdPlaceManualOrder into defaults", async () => {
    const prisma = fakePrisma();
    prisma.tournament.findUnique.mockResolvedValue({
      ...ROW,
      manualTieBreaks: null,
      thirdPlaceManualOrder: null,
    });
    const repo = new PrismaTournamentRepository(prisma as never);

    const t = await repo.get();

    expect(t?.manualTieBreaks).toEqual({});
    expect(t?.thirdPlaceManualOrder).toBeNull();
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
      manualTieBreaks: ROW.manualTieBreaks,
      thirdPlaceManualOrder: ROW.thirdPlaceManualOrder,
    });

    const result = await repo.save(t);

    expect(result.isOk()).toBe(true);
    expect(prisma.tournament.upsert).toHaveBeenCalledWith({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        manualTieBreaks: ROW.manualTieBreaks,
        thirdPlaceManualOrder: ROW.thirdPlaceManualOrder,
      },
      update: {
        manualTieBreaks: ROW.manualTieBreaks,
        thirdPlaceManualOrder: ROW.thirdPlaceManualOrder,
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
