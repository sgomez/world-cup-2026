import { describe, expect, it } from "vitest";
import type { BetSummary } from "@/modules/bet/application/bet-summary";
import {
  type LeaderboardEntry,
  rankEntries,
  scopeMapper,
  scoreBet,
} from "./leaderboard";

describe("scoreBet stub", () => {
  it("should return 0 for any bet", () => {
    expect(scoreBet({ id: "bet-1" })).toBe(0);
    expect(scoreBet({ id: "bet-2" })).toBe(0);
  });
});

describe("rankEntries", () => {
  it("should handle empty input", () => {
    expect(rankEntries([])).toEqual([]);
  });

  it("should sort by points descending", () => {
    const entries: LeaderboardEntry[] = [
      {
        id: "bet-1",
        userId: "user-1",
        userName: "Alice",
        betName: "Bet 1",
        points: 5,
        createdAt: new Date("2026-06-08T12:00:00Z"),
      },
      {
        id: "bet-2",
        userId: "user-2",
        userName: "Bob",
        betName: "Bet 2",
        points: 15,
        createdAt: new Date("2026-06-08T12:00:00Z"),
      },
      {
        id: "bet-3",
        userId: "user-3",
        userName: "Charlie",
        betName: "Bet 3",
        points: 10,
        createdAt: new Date("2026-06-08T12:00:00Z"),
      },
    ];

    const result = rankEntries(entries);
    expect(result.map((e) => e.userName)).toEqual(["Bob", "Charlie", "Alice"]);
    expect(result.map((e) => e.rank)).toEqual([1, 2, 3]);
  });

  it("should assign shared-rank ties and use stable tiebreak (createdAt ascending)", () => {
    const entries: LeaderboardEntry[] = [
      {
        id: "bet-1",
        userId: "user-1",
        userName: "Alice",
        betName: "Bet 1",
        points: 10,
        createdAt: new Date("2026-06-08T12:00:00Z"),
      },
      {
        id: "bet-2",
        userId: "user-2",
        userName: "Bob",
        betName: "Bet 2",
        points: 10,
        createdAt: new Date("2026-06-08T11:00:00Z"), // Bob is earlier than Alice
      },
      {
        id: "bet-3",
        userId: "user-3",
        userName: "Charlie",
        betName: "Bet 3",
        points: 5,
        createdAt: new Date("2026-06-08T10:00:00Z"),
      },
    ];

    const result = rankEntries(entries);
    // Sort order:
    // 1. Bob (10 points, 11:00)
    // 2. Alice (10 points, 12:00)
    // 3. Charlie (5 points, 10:00)
    expect(result.map((e) => e.userName)).toEqual(["Bob", "Alice", "Charlie"]);
    // Ranks:
    // Bob and Alice both have 10 points -> rank 1
    // Charlie has 5 points -> rank 3
    expect(result.map((e) => e.rank)).toEqual([1, 1, 3]);
  });
});

describe("scopeMapper", () => {
  it("should map communities and filter only closed bets", () => {
    const communities = [
      {
        id: "c-1",
        name: "Office",
        slug: "office",
        members: [
          {
            user: {
              id: "user-1",
              name: "Alice",
              image: "alice.png",
            },
          },
          {
            user: {
              id: "user-2",
              name: "Bob",
              image: null,
            },
          },
        ],
      },
    ];

    const betSummaries = new Map<string, BetSummary[]>([
      [
        "user-1",
        [
          {
            id: "bet-1",
            label: "Alice Bet 1 (Closed)",
            status: "closed",
            createdAt: new Date("2026-06-08T12:00:00Z"),
            updatedAt: new Date("2026-06-08T12:00:00Z"),
            signature: "sig1",
          },
          {
            id: "bet-2",
            label: "Alice Bet 2 (Draft)",
            status: "draft",
            createdAt: new Date("2026-06-08T13:00:00Z"),
            updatedAt: new Date("2026-06-08T13:00:00Z"),
            signature: undefined,
          },
        ],
      ],
      [
        "user-2",
        [
          {
            id: "bet-3",
            label: "Bob Bet 1 (Closed)",
            status: "closed",
            createdAt: new Date("2026-06-08T10:00:00Z"),
            updatedAt: new Date("2026-06-08T10:00:00Z"),
            signature: "sig3",
          },
        ],
      ],
    ]);

    const result = scopeMapper(communities, betSummaries);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("office");
    expect(result[0].label).toBe("Office");

    // Only closed bets of the members should be mapped
    expect(result[0].entries).toHaveLength(2);

    const aliceEntry = result[0].entries.find((e) => e.userName === "Alice");
    expect(aliceEntry).toBeDefined();
    expect(aliceEntry?.betName).toBe("Alice Bet 1 (Closed)");
    expect(aliceEntry?.points).toBe(0);
    expect(aliceEntry?.userId).toBe("user-1");
    expect(aliceEntry?.signature).toBe("sig1");

    const bobEntry = result[0].entries.find((e) => e.userName === "Bob");
    expect(bobEntry).toBeDefined();
    expect(bobEntry?.betName).toBe("Bob Bet 1 (Closed)");
    expect(bobEntry?.points).toBe(0);
    expect(bobEntry?.userId).toBe("user-2");
    expect(bobEntry?.signature).toBe("sig3");
  });

  it("should handle users with no bets or no closed bets", () => {
    const communities = [
      {
        id: "c-1",
        name: "Office",
        slug: "office",
        members: [
          {
            user: {
              id: "user-1",
              name: "Alice",
              image: null,
            },
          },
        ],
      },
    ];

    const betSummaries = new Map<string, BetSummary[]>();

    const result = scopeMapper(communities, betSummaries);
    expect(result[0].entries).toHaveLength(0);
  });
});
