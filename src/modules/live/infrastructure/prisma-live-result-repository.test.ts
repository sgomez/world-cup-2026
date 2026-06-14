import { describe, expect, it, vi } from "vitest";
import { LiveResult } from "../domain/live-result";
import { PrismaLiveResultRepository } from "./prisma-live-result-repository";

const ROW = {
  num: 1,
  status: "finished",
  goals1: 2,
  goals2: 1,
  penalties1: null,
  penalties2: null,
  phase: null,
  minute: null,
  inStoppage: null,
  createdAt: new Date("2026-06-11T20:00:00Z"),
  updatedAt: new Date("2026-06-11T21:00:00Z"),
};

const KNOCKOUT_ROW = {
  num: 73,
  status: "finished",
  goals1: 1,
  goals2: 1,
  penalties1: 5,
  penalties2: 4,
  phase: null,
  minute: null,
  inStoppage: null,
  createdAt: new Date("2026-06-30T20:00:00Z"),
  updatedAt: new Date("2026-06-30T21:00:00Z"),
};

function fakePrisma() {
  return {
    liveResult: {
      findUnique: vi.fn(),
      upsert: vi.fn().mockResolvedValue({}),
    },
  };
}

describe("PrismaLiveResultRepository.findByNum", () => {
  it("maps a row into a LiveResult aggregate", async () => {
    const prisma = fakePrisma();
    prisma.liveResult.findUnique.mockResolvedValue(ROW);
    const repo = new PrismaLiveResultRepository(prisma as never);

    const lr = await repo.findByNum(1);

    expect(lr?.num).toBe(1);
    expect(lr?.status).toBe("finished");
    expect(lr?.goals1).toBe(2);
    expect(lr?.goals2).toBe(1);
    expect(lr?.penalties1).toBeUndefined();
    expect(lr?.penalties2).toBeUndefined();
    expect(lr?.phase).toBeNull();
    expect(lr?.minute).toBeNull();
    expect(lr?.inStoppage).toBeNull();
    expect(lr?.createdAt).toEqual(ROW.createdAt);
    expect(lr?.updatedAt).toEqual(ROW.updatedAt);
    expect(prisma.liveResult.findUnique).toHaveBeenCalledWith({
      where: { num: 1 },
    });
  });

  it("maps penalties from a knockout row", async () => {
    const prisma = fakePrisma();
    prisma.liveResult.findUnique.mockResolvedValue(KNOCKOUT_ROW);
    const repo = new PrismaLiveResultRepository(prisma as never);

    const lr = await repo.findByNum(73);

    expect(lr?.penalties1).toBe(5);
    expect(lr?.penalties2).toBe(4);
  });

  it("maps phase/minute/inStoppage from a live row", async () => {
    const prisma = fakePrisma();
    prisma.liveResult.findUnique.mockResolvedValue({
      ...ROW,
      status: "live",
      phase: "first_half",
      minute: 23,
      inStoppage: false,
    });
    const repo = new PrismaLiveResultRepository(prisma as never);

    const lr = await repo.findByNum(1);

    expect(lr?.phase).toBe("first_half");
    expect(lr?.minute).toBe(23);
    expect(lr?.inStoppage).toBe(false);
  });

  it("returns null when row is absent", async () => {
    const prisma = fakePrisma();
    prisma.liveResult.findUnique.mockResolvedValue(null);
    const repo = new PrismaLiveResultRepository(prisma as never);

    expect(await repo.findByNum(99)).toBeNull();
  });
});

describe("PrismaLiveResultRepository.save", () => {
  it("upserts a group match row", async () => {
    const prisma = fakePrisma();
    const repo = new PrismaLiveResultRepository(prisma as never);
    const lr = LiveResult.fromState({
      num: 1,
      status: "finished",
      goals1: 2,
      goals2: 1,
    });

    const result = await repo.save(lr);

    expect(result.isOk()).toBe(true);
    expect(prisma.liveResult.upsert).toHaveBeenCalledWith({
      where: { num: 1 },
      create: {
        num: 1,
        status: "finished",
        goals1: 2,
        goals2: 1,
        penalties1: null,
        penalties2: null,
        phase: null,
        minute: null,
        inStoppage: null,
      },
      update: {
        status: "finished",
        goals1: 2,
        goals2: 1,
        penalties1: null,
        penalties2: null,
        phase: null,
        minute: null,
        inStoppage: null,
      },
    });
  });

  it("upserts a knockout row with penalties", async () => {
    const prisma = fakePrisma();
    const repo = new PrismaLiveResultRepository(prisma as never);
    const lr = LiveResult.fromState({
      num: 73,
      status: "finished",
      goals1: 1,
      goals2: 1,
      penalties1: 5,
      penalties2: 4,
    });

    const result = await repo.save(lr);

    expect(result.isOk()).toBe(true);
    expect(prisma.liveResult.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ penalties1: 5, penalties2: 4 }),
        update: expect.objectContaining({ penalties1: 5, penalties2: 4 }),
      }),
    );
  });

  it("maps any persistence failure to SAVE_FAILED", async () => {
    const prisma = fakePrisma();
    prisma.liveResult.upsert.mockRejectedValue(new Error("db down"));
    const repo = new PrismaLiveResultRepository(prisma as never);
    const lr = LiveResult.fromState({
      num: 1,
      status: "live",
      goals1: 0,
      goals2: 0,
    });

    const result = await repo.save(lr);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("SAVE_FAILED");
  });
});
