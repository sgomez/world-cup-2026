import { beforeEach, describe, expect, it, vi } from "vitest";
import { LiveResult } from "@/modules/live/domain/live-result";
import { InMemoryLiveResultRepository } from "@/modules/live/infrastructure/in-memory-live-result-repository";

// Initialized at module level so the container always holds this same instance.
// Never replace this variable — mutate via setData() instead.
const sharedRepo = new InMemoryLiveResultRepository();

vi.mock("@/modules/live/infrastructure/prisma-live-result-repository", () => {
  return {
    PrismaLiveResultRepository: class FakeRepo {
      constructor() {
        // biome-ignore lint/correctness/noConstructorReturn: test double returns shared in-memory repo
        return sharedRepo;
      }
    },
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

function makeLr(
  num: number,
  status: "upcoming" | "live" | "finished",
  goals1 = 0,
  goals2 = 0,
) {
  return LiveResult.fromState({ num, status, goals1, goals2 });
}

function makeRequest(params?: string) {
  const url = `http://localhost/api/live/matches${params ? `?${params}` : ""}`;
  return new Request(url);
}

describe("GET /api/live/matches", () => {
  beforeEach(() => {
    sharedRepo.setData(new Map());
  });

  it("returns empty array when no results exist", async () => {
    const { GET } = await import("./route");
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("defaults to live-only when no status param", async () => {
    await sharedRepo.save(makeLr(1, "live", 1, 0));
    await sharedRepo.save(makeLr(2, "finished", 2, 1));
    await sharedRepo.save(makeLr(3, "upcoming"));
    await sharedRepo.save(makeLr(4, "live"));

    const { GET } = await import("./route");
    const res = await GET(makeRequest());
    const data = await res.json();
    expect(data).toHaveLength(2);
    expect(data.map((d: { num: number }) => d.num).sort()).toEqual([1, 4]);
  });

  it("returns live and finished when status=live,finished", async () => {
    await sharedRepo.save(makeLr(1, "live", 1, 0));
    await sharedRepo.save(makeLr(2, "finished", 2, 1));
    await sharedRepo.save(makeLr(3, "upcoming"));

    const { GET } = await import("./route");
    const res = await GET(makeRequest("status=live,finished"));
    const data = await res.json();
    expect(data).toHaveLength(2);
    expect(data.map((d: { num: number }) => d.num).sort()).toEqual([1, 2]);
  });

  it("ignores unknown status values", async () => {
    await sharedRepo.save(makeLr(1, "live"));
    await sharedRepo.save(makeLr(2, "finished"));

    const { GET } = await import("./route");
    const res = await GET(makeRequest("status=live,bogus"));
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].num).toBe(1);
  });

  it("returns expected shape for a live match", async () => {
    await sharedRepo.save(makeLr(11, "live", 2, 1));

    const { GET } = await import("./route");
    const res = await GET(makeRequest());
    const data = await res.json();
    const match = data.find((m: { num: number }) => m.num === 11);
    expect(match).toMatchObject({
      num: 11,
      status: "live",
      goals1: 2,
      goals2: 1,
    });
    expect(match.penalties1).toBeUndefined();
    expect(match.penalties2).toBeUndefined();
  });
});
