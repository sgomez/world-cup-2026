import { describe, expect, it } from "vitest";
import { Bet } from "@/modules/bet/domain/bet";
import { type LeaderboardEntry, rankEntries, scopeMapper } from "./leaderboard";
import { createInitialState } from "./prediction-state";
import { extractScoreableContent } from "./scoring";

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
    expect(result.map((e) => e.userName)).toEqual(["Bob", "Alice", "Charlie"]);
    expect(result.map((e) => e.rank)).toEqual([1, 1, 3]);
  });
});

describe("scopeMapper", () => {
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

  const bets = new Map<string, Bet[]>([
    [
      "user-1",
      [
        Bet.fromState({
          id: "bet-1",
          userId: "user-1",
          label: "Alice Bet 1 (Closed)",
          status: "closed",
          createdAt: new Date("2026-06-08T12:00:00Z"),
          updatedAt: new Date("2026-06-08T12:00:00Z"),
          groupPredictions: null,
          knockoutWinners: {},
        }),
        Bet.fromState({
          id: "bet-2",
          userId: "user-1",
          label: "Alice Bet 2 (Draft)",
          status: "draft",
          createdAt: new Date("2026-06-08T13:00:00Z"),
          updatedAt: new Date("2026-06-08T13:00:00Z"),
          groupPredictions: null,
          knockoutWinners: {},
        }),
      ],
    ],
    [
      "user-2",
      [
        Bet.fromState({
          id: "bet-3",
          userId: "user-2",
          label: "Bob Bet 1 (Closed)",
          status: "closed",
          createdAt: new Date("2026-06-08T10:00:00Z"),
          updatedAt: new Date("2026-06-08T10:00:00Z"),
          groupPredictions: null,
          knockoutWinners: {},
        }),
      ],
    ],
  ]);

  it("should map communities, filter only closed bets and apply pre-deadline gate (points = 0)", () => {
    const result = scopeMapper(communities, bets, null, false);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("office");
    expect(result[0].label).toBe("Office");

    // Only closed bets of the members should be mapped (draft bet-2 is excluded)
    expect(result[0].entries).toHaveLength(2);

    const aliceEntry = result[0].entries.find((e) => e.userName === "Alice");
    expect(aliceEntry).toBeDefined();
    expect(aliceEntry?.betName).toBe("Alice Bet 1 (Closed)");
    expect(aliceEntry?.points).toBe(0);
    expect(aliceEntry?.userId).toBe("user-1");
    expect(aliceEntry?.signature).toBe(
      "dfb3e1942172957c618c8649afd6a8894f459073ea892bae17f90f182f172aa7",
    ); // derived signature

    const bobEntry = result[0].entries.find((e) => e.userName === "Bob");
    expect(bobEntry).toBeDefined();
    expect(bobEntry?.betName).toBe("Bob Bet 1 (Closed)");
    expect(bobEntry?.points).toBe(0);
    expect(bobEntry?.userId).toBe("user-2");
  });

  it("should compute real points after the deadline when actualResults are provided", () => {
    // Generate actual results based on some default teams to ensure a match
    const { knockoutMatches: defaultMatches } = createInitialState(null, null);
    const defaultContent = extractScoreableContent(defaultMatches);
    const defaultTeams = Array.from(defaultContent.R32);

    // Let's match 3 teams in R32 (3 * 3 = 9 points)
    const actualResults = {
      R32: defaultTeams.slice(0, 3),
      R16: [],
      QF: [],
      SF: [],
      F: [],
      champion: null,
      thirdPlace: null,
    };

    const result = scopeMapper(communities, bets, actualResults, true);

    const aliceEntry = result[0].entries.find((e) => e.userName === "Alice");
    expect(aliceEntry?.points).toBe(9);

    const bobEntry = result[0].entries.find((e) => e.userName === "Bob");
    expect(bobEntry?.points).toBe(9);
  });

  it("should handle users with no bets or no closed bets", () => {
    const result = scopeMapper(communities, new Map(), null, false);
    expect(result[0].entries).toHaveLength(0);
  });
});
