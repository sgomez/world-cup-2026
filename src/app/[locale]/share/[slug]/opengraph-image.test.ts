import { describe, expect, it } from "vitest";
import { prepareCardEntries } from "./opengraph-image";

type Entry = { label: string; points: number; rank: number };

describe("prepareCardEntries", () => {
  const makeEntry = (rank: number, pts: number): Entry => ({
    label: `Bet ${rank}`,
    points: pts,
    rank,
  });

  it("should return single list when entries count is 0", () => {
    const result = prepareCardEntries([], 3);
    expect(result.isSingle).toBe(true);
    expect(result.displayBest).toEqual([]);
    expect(result.displayWorst).toEqual([]);
  });

  it("should return single list when entries count is less than 2n", () => {
    const entries = [makeEntry(1, 100), makeEntry(2, 80), makeEntry(3, 60)];
    const result = prepareCardEntries(entries, 3); // 3 ≤ 6
    expect(result.isSingle).toBe(true);
    expect(result.displayBest).toHaveLength(3);
    expect(result.displayWorst).toHaveLength(0);
  });

  it("should return single list when entries count exactly equals 2n", () => {
    const entries = [
      makeEntry(1, 100),
      makeEntry(2, 90),
      makeEntry(3, 80),
      makeEntry(4, 70),
      makeEntry(5, 60),
      makeEntry(6, 50),
    ];
    const result = prepareCardEntries(entries, 3); // 6 = 2*3
    expect(result.isSingle).toBe(true);
    expect(result.displayBest).toHaveLength(6);
    expect(result.displayWorst).toHaveLength(0);
  });

  it("should return disjoint best and worst when entries > 2n", () => {
    const entries = [
      makeEntry(1, 200),
      makeEntry(2, 180),
      makeEntry(3, 160),
      makeEntry(4, 140),
      makeEntry(5, 120),
      makeEntry(6, 100),
      makeEntry(7, 80),
    ];
    const result = prepareCardEntries(entries, 3); // 7 > 6
    expect(result.isSingle).toBe(false);
    expect(result.displayBest).toHaveLength(3);
    expect(result.displayWorst).toHaveLength(3);

    // Best = top 3
    expect(result.displayBest[0].rank).toBe(1);
    expect(result.displayBest[1].rank).toBe(2);
    expect(result.displayBest[2].rank).toBe(3);

    // Worst = bottom 3
    expect(result.displayWorst[0].rank).toBe(5);
    expect(result.displayWorst[1].rank).toBe(6);
    expect(result.displayWorst[2].rank).toBe(7);
  });

  it("should not have duplicates in best and worst", () => {
    const entries = [
      makeEntry(1, 200),
      makeEntry(2, 180),
      makeEntry(3, 160),
      makeEntry(4, 140),
      makeEntry(5, 120),
      makeEntry(6, 100),
      makeEntry(7, 80),
    ];
    const result = prepareCardEntries(entries, 3);
    const bestRanks = new Set(result.displayBest.map((e) => e.rank));
    const worstRanks = new Set(result.displayWorst.map((e) => e.rank));
    for (const rank of bestRanks) {
      expect(worstRanks.has(rank)).toBe(false);
    }
  });

  it("should include zero-point entries as worst", () => {
    const entries = [
      makeEntry(1, 200),
      makeEntry(2, 150),
      makeEntry(3, 100),
      makeEntry(4, 50),
      makeEntry(5, 20),
      makeEntry(6, 10),
      makeEntry(7, 0),
    ];
    const result = prepareCardEntries(entries, 3);
    expect(result.isSingle).toBe(false);
    // Worst 3 include the 0-point entry
    expect(result.displayWorst.some((e) => e.points === 0)).toBe(true);
  });
});
