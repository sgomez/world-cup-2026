import { describe, expect, it } from "vitest";
import { Bet } from "@/modules/bet/domain/bet";
import { LiveResult } from "@/modules/live/domain/live-result";
import { calculateRankHistory } from "./rank-history";

describe("calculateRankHistory", () => {
  it("should handle empty inputs and return only step 0", () => {
    const steps = calculateRankHistory([], [], null);
    expect(steps).toHaveLength(1);
    expect(steps[0]).toEqual({
      matchNum: 0,
      isLive: false,
      ranks: {},
    });
  });

  it("should place all closed bets at rank 1 with 0 points at step 0", () => {
    const betAlice = Bet.fromState({
      id: "bet-alice",
      userId: "user-alice",
      label: "Alice",
      status: "closed",
      groupPredictions: null,
      knockoutWinners: {},
      directPredictions: {
        R32: ["mex"],
        R16: [],
        QF: [],
        SF: [],
        F: [],
        champion: null,
        thirdPlace: null,
      },
      createdAt: new Date("2026-06-10T12:00:00Z"),
    });

    const betBob = Bet.fromState({
      id: "bet-bob",
      userId: "user-bob",
      label: "Bob",
      status: "closed",
      groupPredictions: null,
      knockoutWinners: {},
      directPredictions: {
        R32: ["rsa"],
        R16: [],
        QF: [],
        SF: [],
        F: [],
        champion: null,
        thirdPlace: null,
      },
      createdAt: new Date("2026-06-10T13:00:00Z"),
    });

    const steps = calculateRankHistory([betAlice, betBob], [], null);
    expect(steps).toHaveLength(1);
    expect(steps[0]).toEqual({
      matchNum: 0,
      isLive: false,
      ranks: {
        "bet-alice": { rank: 1, points: 0 },
        "bet-bob": { rank: 1, points: 0 },
      },
    });
  });

  it("should sequence steps correctly and calculate ranks with stable tiebreaking", () => {
    const betAlice = Bet.fromState({
      id: "bet-alice",
      userId: "user-alice",
      label: "Alice",
      status: "closed",
      groupPredictions: null,
      knockoutWinners: {},
      directPredictions: {
        R32: ["mex"],
        R16: [],
        QF: [],
        SF: [],
        F: [],
        champion: null,
        thirdPlace: null,
      },
      createdAt: new Date("2026-06-10T12:00:00Z"),
    });

    const betBob = Bet.fromState({
      id: "bet-bob",
      userId: "user-bob",
      label: "Bob",
      status: "closed",
      groupPredictions: null,
      knockoutWinners: {},
      directPredictions: {
        R32: ["rsa"],
        R16: [],
        QF: [],
        SF: [],
        F: [],
        champion: null,
        thirdPlace: null,
      },
      createdAt: new Date("2026-06-10T13:00:00Z"),
    });

    // Mock 6 matches of Group A (finished)
    const results = [
      LiveResult.fromState({
        num: 1,
        status: "finished",
        goals1: 2,
        goals2: 0,
      }), // MEX 2 - 0 RSA
      LiveResult.fromState({
        num: 2,
        status: "finished",
        goals1: 0,
        goals2: 2,
      }), // KOR 0 - 2 CZE
      LiveResult.fromState({
        num: 25,
        status: "finished",
        goals1: 2,
        goals2: 0,
      }), // CZE 2 - 0 RSA
      LiveResult.fromState({
        num: 26,
        status: "finished",
        goals1: 2,
        goals2: 0,
      }), // MEX 2 - 0 KOR
      LiveResult.fromState({
        num: 49,
        status: "finished",
        goals1: 0,
        goals2: 2,
      }), // CZE 0 - 2 MEX
      LiveResult.fromState({
        num: 50,
        status: "finished",
        goals1: 0,
        goals2: 2,
      }), // RSA 0 - 2 KOR
    ];

    const steps = calculateRankHistory([betAlice, betBob], results, null);

    // Step 0 + 6 finished matches = 7 steps
    expect(steps).toHaveLength(7);

    // Step 0 (initial state, Match 0) - 0 points, tied at rank 1
    expect(steps[0].ranks["bet-alice"]).toEqual({ rank: 1, points: 0 });
    expect(steps[0].ranks["bet-bob"]).toEqual({ rank: 1, points: 0 });

    // Steps 1 to 5 (matches 1, 2, 25, 26, 49) - Group A in progress. MEX advances provisionally.
    // Alice gets 3 points (rank 1), Bob gets 0 points (rank 2).
    for (let i = 1; i <= 5; i++) {
      expect(steps[i].ranks["bet-alice"]).toEqual({ rank: 1, points: 3 });
      expect(steps[i].ranks["bet-bob"]).toEqual({ rank: 2, points: 0 });
    }

    // Step 6 (match 50) - Group A finished. MEX advances (1st). Alice gets 3 points. Bob gets 0 points.
    const lastStep = steps[6];
    expect(lastStep.matchNum).toBe(50);
    expect(lastStep.ranks["bet-alice"]).toEqual({ rank: 1, points: 3 });
    expect(lastStep.ranks["bet-bob"]).toEqual({ rank: 2, points: 0 });
  });

  it("should add a provisional step at the end if there are live matches", () => {
    const betAlice = Bet.fromState({
      id: "bet-alice",
      userId: "user-alice",
      label: "Alice",
      status: "closed",
      groupPredictions: null,
      knockoutWinners: {},
      directPredictions: {
        R32: ["mex"],
        R16: [],
        QF: [],
        SF: [],
        F: [],
        champion: null,
        thirdPlace: null,
      },
      createdAt: new Date("2026-06-10T12:00:00Z"),
    });

    const betBob = Bet.fromState({
      id: "bet-bob",
      userId: "user-bob",
      label: "Bob",
      status: "closed",
      groupPredictions: null,
      knockoutWinners: {},
      directPredictions: {
        R32: ["rsa"],
        R16: [],
        QF: [],
        SF: [],
        F: [],
        champion: null,
        thirdPlace: null,
      },
      createdAt: new Date("2026-06-10T13:00:00Z"),
    });

    // 5 matches finished, 6th match (match 50) is live
    const results = [
      LiveResult.fromState({
        num: 1,
        status: "finished",
        goals1: 2,
        goals2: 0,
      }), // MEX 2 - 0 RSA
      LiveResult.fromState({
        num: 2,
        status: "finished",
        goals1: 0,
        goals2: 2,
      }), // KOR 0 - 2 CZE
      LiveResult.fromState({
        num: 25,
        status: "finished",
        goals1: 2,
        goals2: 0,
      }), // CZE 2 - 0 RSA
      LiveResult.fromState({
        num: 26,
        status: "finished",
        goals1: 2,
        goals2: 0,
      }), // MEX 2 - 0 KOR
      LiveResult.fromState({
        num: 49,
        status: "finished",
        goals1: 0,
        goals2: 2,
      }), // CZE 0 - 2 MEX
      LiveResult.fromState({ num: 50, status: "live", goals1: 0, goals2: 2 }), // RSA 0 - 2 KOR
    ];

    const steps = calculateRankHistory([betAlice, betBob], results, null);

    // Step 0 + 5 finished matches + 1 provisional step = 7 steps
    expect(steps).toHaveLength(7);

    // Last step is provisional (isLive = true) and represents match 50
    const lastStep = steps[6];
    expect(lastStep.isLive).toBe(true);
    expect(lastStep.matchNum).toBe(50);
    // In provisional mode, group standing includes live results, so MEX advances
    expect(lastStep.ranks["bet-alice"].points).toBe(3);
    expect(lastStep.ranks["bet-bob"].points).toBe(0);
  });
});
