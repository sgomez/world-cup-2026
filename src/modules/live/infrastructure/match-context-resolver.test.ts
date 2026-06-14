import { beforeEach, describe, expect, it, vi } from "vitest";
import { LiveResult } from "../domain/live-result";
import { ProductionMatchContextResolver } from "./match-context-resolver";

// ---------------------------------------------------------------------------
// ProductionMatchContextResolver
// ---------------------------------------------------------------------------

// We need to mock the data layer modules that the production resolver uses.
// We mock deriveResult and getAllMatches + getTeamById.

// These would hold shared mock data; currently unused (tests use FakeLiveResultRepository directly).
const _mockLiveResults: LiveResult[] = [];
const _mockManualTieBreaks: Record<string, Record<string, number>> = {};

vi.mock("@/modules/tournament/domain/derive-result", async () => {
  const actual = await vi.importActual<
    typeof import("@/modules/tournament/domain/derive-result")
  >("@/modules/tournament/domain/derive-result");
  return {
    ...actual,
    deriveResult: vi.fn(),
  };
});

vi.mock("@/modules/teams", async () => {
  const actual =
    await vi.importActual<typeof import("@/modules/teams")>("@/modules/teams");
  return {
    ...actual,
    getTeamById: vi.fn(),
  };
});

import { getTeamById } from "@/modules/teams";
import { deriveResult } from "@/modules/tournament/domain/derive-result";
// We also need to mock the live result repository usage inside the resolver.
// The production impl takes a repository, so we pass a fake one directly.
import type { LiveResultRepository } from "../domain/live-result-repository";

class FakeLiveResultRepository implements LiveResultRepository {
  private store: LiveResult[];
  constructor(results: LiveResult[]) {
    this.store = results;
  }
  async findByNum(num: number) {
    return this.store.find((r) => r.num === num) ?? null;
  }
  async findAll() {
    return this.store;
  }
  save(): never {
    throw new Error("Not implemented in FakeLiveResultRepository");
  }
}

describe("ProductionMatchContextResolver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null for a group-stage match (num < 73)", () => {
    const repo = new FakeLiveResultRepository([]);
    const resolver = new ProductionMatchContextResolver(repo);
    const result = resolver.resolveParticipants(1);
    expect(result).toBeNull();
  });

  it("returns null for a group-stage match boundary (num = 72)", () => {
    const repo = new FakeLiveResultRepository([]);
    const resolver = new ProductionMatchContextResolver(repo);
    const result = resolver.resolveParticipants(72);
    expect(result).toBeNull();
  });

  it("resolves knockout participants from deriveResult + getTeamById", async () => {
    const finishedLiveResults = [
      LiveResult.fromState({
        num: 1,
        status: "finished",
        goals1: 2,
        goals2: 1,
      }),
    ];
    const repo = new FakeLiveResultRepository(finishedLiveResults);

    // Match 73 is R32-73: 2A vs 2B.
    // getTeamIdFromPosition("2A", groupOrders) → groupOrders["A"][1] = "mex"
    // getTeamIdFromPosition("2B", groupOrders) → groupOrders["B"][1] = "usa"
    // Both "2A" and "2B" must be in advancement for buildR32Matches to populate team IDs.
    vi.mocked(deriveResult).mockReturnValue({
      groupOrders: {
        A: ["rsa", "mex", "kor", "cze"],
        B: ["can", "usa", "qat", "sui"],
      },
      thirdPlaceOrder: [],
      knockoutWinners: {},
      advancement: ["2A", "2B"],
      standingsTable: {} as any,
    });

    vi.mocked(getTeamById).mockImplementation((id, _locale) => {
      if (id === "mex")
        return { id: "mex", name: "Mexico", flag: "🇲🇽", code: "mx" };
      if (id === "usa")
        return { id: "usa", name: "United States", flag: "🇺🇸", code: "us" };
      return null;
    });

    const resolver = new ProductionMatchContextResolver(repo);

    // Must call init() first (async load)
    await resolver.init();

    // match 73 is in R32 bracket slot "R32-73": 2A (runner-up Group A) vs 2B (runner-up Group B)
    const result = resolver.resolveParticipants(73);
    expect(result).toEqual({ home: "Mexico", away: "United States" });
  });

  it("returns null when knockoutWinners has no entry for both participants yet", async () => {
    const repo = new FakeLiveResultRepository([]);

    vi.mocked(deriveResult).mockReturnValue({
      groupOrders: {},
      thirdPlaceOrder: [],
      knockoutWinners: {},
      advancement: [],
      standingsTable: {} as any,
    });

    const resolver = new ProductionMatchContextResolver(repo);
    await resolver.init();

    const result = resolver.resolveParticipants(73);
    expect(result).toBeNull();
  });

  it("returns null when getTeamById cannot resolve a team name", async () => {
    const repo = new FakeLiveResultRepository([]);

    vi.mocked(deriveResult).mockReturnValue({
      groupOrders: {},
      thirdPlaceOrder: [],
      knockoutWinners: { "R32-73": "unknown_team" },
      advancement: [],
      standingsTable: {} as any,
    });

    vi.mocked(getTeamById).mockReturnValue(null);

    const resolver = new ProductionMatchContextResolver(repo);
    await resolver.init();

    const result = resolver.resolveParticipants(73);
    expect(result).toBeNull();
  });

  it("memoizes derivation — deriveResult called once across multiple resolveParticipants calls", async () => {
    const repo = new FakeLiveResultRepository([]);

    vi.mocked(deriveResult).mockReturnValue({
      groupOrders: {},
      thirdPlaceOrder: [],
      knockoutWinners: { "R32-73": "mex", "R32-74": "usa" },
      advancement: [],
      standingsTable: {} as any,
    });

    vi.mocked(getTeamById).mockImplementation((id) => {
      if (id === "mex")
        return { id: "mex", name: "Mexico", flag: "🇲🇽", code: "mx" };
      if (id === "usa")
        return { id: "usa", name: "United States", flag: "🇺🇸", code: "us" };
      return null;
    });

    const resolver = new ProductionMatchContextResolver(repo);
    await resolver.init();

    resolver.resolveParticipants(73);
    resolver.resolveParticipants(74);
    resolver.resolveParticipants(73);

    // Only one derivation across the Tick (memoized)
    expect(vi.mocked(deriveResult)).toHaveBeenCalledTimes(1);
  });

  it("resetMemo causes re-derivation on next call", async () => {
    const repo = new FakeLiveResultRepository([]);

    vi.mocked(deriveResult).mockReturnValue({
      groupOrders: {},
      thirdPlaceOrder: [],
      knockoutWinners: {},
      advancement: [],
      standingsTable: {} as any,
    });

    const resolver = new ProductionMatchContextResolver(repo);
    await resolver.init();

    resolver.resolveParticipants(73);
    resolver.resetMemo();
    await resolver.init();
    resolver.resolveParticipants(73);

    expect(vi.mocked(deriveResult)).toHaveBeenCalledTimes(2);
  });
});
