import { describe, expect, it } from "vitest";
import { Bet } from "../../bet/domain/bet";
import { InMemoryBetRepository } from "../../bet/infrastructure/in-memory-bet-repository";
import { Community } from "../../community/domain/community";
import { InMemoryCommunityRepository } from "../../community/infrastructure/in-memory-community-repository";
import { LiveResult } from "../../live/domain/live-result";
import { InMemoryLiveResultRepository } from "../../live/infrastructure/in-memory-live-result-repository";
import { Tournament } from "../../tournament/domain/tournament";
import { InMemoryTournamentRepository } from "../../tournament/infrastructure/in-memory-tournament-repository";
import { getRankHistory } from "./get-rank-history";

describe("getRankHistory Application Service Integration Tests", () => {
  const mockGetUserName = async (userId: string) => {
    if (userId.startsWith("user-user-")) {
      const num = userId.substring("user-user-".length);
      return `User ${num}`;
    }
    if (userId === "user-alice") return "Alice";
    if (userId === "user-bob") return "Bob";
    return null;
  };

  it("should return NOT_FOUND error if community is not found", async () => {
    const communityRepo = new InMemoryCommunityRepository([]);
    const betRepo = new InMemoryBetRepository([]);
    const tournamentRepo = new InMemoryTournamentRepository(null);
    const liveResultRepo = new InMemoryLiveResultRepository([]);

    const result = await getRankHistory(
      communityRepo,
      betRepo,
      tournamentRepo,
      liveResultRepo,
      mockGetUserName,
      {
        viewerId: "user-alice",
        communitySlug: "non-existent",
      },
    );

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("NOT_FOUND");
  });

  it("should return FORBIDDEN error if the viewer is not a community member", async () => {
    const community = Community.fromState({
      id: "comm-1",
      name: "Champs",
      slug: "champs",
      ownerId: "user-alice",
      inviteToken: "token-123",
      memberIds: ["user-alice"],
    });

    const communityRepo = new InMemoryCommunityRepository([community]);
    const betRepo = new InMemoryBetRepository([]);
    const tournamentRepo = new InMemoryTournamentRepository(null);
    const liveResultRepo = new InMemoryLiveResultRepository([]);

    const result = await getRankHistory(
      communityRepo,
      betRepo,
      tournamentRepo,
      liveResultRepo,
      mockGetUserName,
      {
        viewerId: "user-outsider",
        communitySlug: "champs",
      },
    );

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("FORBIDDEN");
  });

  it("should calculate rank history, filter to top 10 + viewer's bets, and exclude draft bets", async () => {
    const memberIds = ["user-alice", "user-bob"];
    for (let i = 1; i <= 12; i++) {
      memberIds.push(`user-user-${i}`);
    }

    const community = Community.fromState({
      id: "comm-1",
      name: "Champs",
      slug: "champs",
      ownerId: "user-alice",
      inviteToken: "token-123",
      memberIds,
    });

    // We will create 12 closed bets.
    // Bets 1 to 9 predict "mex" in R32.
    // Bet 10 predicts "cze" in R32.
    // Bet 11 predicts "kor" in R32.
    // Bet 12 predicts "rsa" in R32.
    const bets: Bet[] = [];
    for (let i = 1; i <= 9; i++) {
      bets.push(
        Bet.fromState({
          id: `bet-${i}`,
          userId: `user-user-${i}`,
          label: `Bet ${i}`,
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
          createdAt: new Date(`2026-06-08T12:00:0${i}Z`),
        }),
      );
    }

    bets.push(
      Bet.fromState({
        id: "bet-10",
        userId: "user-user-10",
        label: "Bet 10",
        status: "closed",
        groupPredictions: null,
        knockoutWinners: {},
        directPredictions: {
          R32: ["cze"],
          R16: [],
          QF: [],
          SF: [],
          F: [],
          champion: null,
          thirdPlace: null,
        },
        createdAt: new Date("2026-06-08T12:00:10Z"),
      }),
    );

    bets.push(
      Bet.fromState({
        id: "bet-11",
        userId: "user-user-11",
        label: "Bet 11",
        status: "closed",
        groupPredictions: null,
        knockoutWinners: {},
        directPredictions: {
          R32: ["kor"],
          R16: [],
          QF: [],
          SF: [],
          F: [],
          champion: null,
          thirdPlace: null,
        },
        createdAt: new Date("2026-06-08T12:00:11Z"),
      }),
    );

    bets.push(
      Bet.fromState({
        id: "bet-12",
        userId: "user-user-12",
        label: "Bet 12",
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
        createdAt: new Date("2026-06-08T12:00:12Z"),
      }),
    );

    // draft bet (should be completely ignored)
    const draftBet = Bet.fromState({
      id: "bet-draft",
      userId: "user-draft",
      label: "Draft Bet",
      status: "draft",
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
      createdAt: new Date("2026-06-08T12:00:00Z"),
    });
    bets.push(draftBet);

    // Mock 6 matches of Group A (finished)
    // MEX and CZE advance
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

    const communityRepo = new InMemoryCommunityRepository([community]);
    const betRepo = new InMemoryBetRepository(bets);
    const tournamentRepo = new InMemoryTournamentRepository(
      Tournament.createDefault(),
    );
    const liveResultRepo = new InMemoryLiveResultRepository(results);

    const result = await getRankHistory(
      communityRepo,
      betRepo,
      tournamentRepo,
      liveResultRepo,
      mockGetUserName,
      {
        viewerId: "user-user-12", // viewer is user of bet-12
        communitySlug: "champs",
      },
    );

    expect(result.isOk()).toBe(true);
    const response = result._unsafeUnwrap();

    // Verify bets returned (should be 10: bet-1 to bet-9 plus bet-12, replacing bet-10)
    const returnedBetIds = response.bets.map((b) => b.id);
    expect(returnedBetIds).toHaveLength(10);
    expect(returnedBetIds).toContain("bet-1");
    expect(returnedBetIds).toContain("bet-9");
    expect(returnedBetIds).toContain("bet-12");
    expect(returnedBetIds).not.toContain("bet-10");
    expect(returnedBetIds).not.toContain("bet-11");
    expect(returnedBetIds).not.toContain("bet-draft");

    // Verify steps ranks are also filtered to only include those 10 bets
    for (const step of response.steps) {
      const rankKeys = Object.keys(step.ranks);
      expect(rankKeys).toHaveLength(10);
      expect(rankKeys).toContain("bet-1");
      expect(rankKeys).toContain("bet-12");
      expect(rankKeys).not.toContain("bet-10");
      expect(rankKeys).not.toContain("bet-11");
      expect(rankKeys).not.toContain("bet-draft");
    }
  });

  it("should return obfuscated labels for non-owners in imported communities", async () => {
    const community = Community.fromState({
      id: "comm-1",
      name: "Champs",
      slug: "champs",
      ownerId: "user-alice",
      inviteToken: "token-123",
      memberIds: ["user-alice", "user-bob"],
      imported: true,
    });

    const aliceBet = Bet.fromState({
      id: "bet-alice",
      userId: "user-alice",
      label: "123 | Alice Smith",
      status: "closed",
      groupPredictions: null,
      knockoutWinners: {},
      createdAt: new Date("2026-06-08T12:00:00Z"),
    });

    const communityRepo = new InMemoryCommunityRepository([community]);
    const betRepo = new InMemoryBetRepository([aliceBet]);
    const tournamentRepo = new InMemoryTournamentRepository(null);
    const liveResultRepo = new InMemoryLiveResultRepository([]);

    const result = await getRankHistory(
      communityRepo,
      betRepo,
      tournamentRepo,
      liveResultRepo,
      mockGetUserName,
      {
        viewerId: "user-bob", // non-owner viewer
        communitySlug: "champs",
      },
    );

    expect(result.isOk()).toBe(true);
    const response = result._unsafeUnwrap();
    expect(response.bets[0].label).toEqual({
      obfuscated: true,
      num: "123",
      head: "Al",
      tail: "th",
      middleLen: 7,
    });
  });

  it("should return full labels for the Import Owner in imported communities", async () => {
    const community = Community.fromState({
      id: "comm-1",
      name: "Champs",
      slug: "champs",
      ownerId: "user-alice",
      inviteToken: "token-123",
      memberIds: ["user-alice", "user-bob"],
      imported: true,
    });

    const aliceBet = Bet.fromState({
      id: "bet-alice",
      userId: "user-alice",
      label: "123 | Alice Smith",
      status: "closed",
      groupPredictions: null,
      knockoutWinners: {},
      createdAt: new Date("2026-06-08T12:00:00Z"),
    });

    const communityRepo = new InMemoryCommunityRepository([community]);
    const betRepo = new InMemoryBetRepository([aliceBet]);
    const tournamentRepo = new InMemoryTournamentRepository(null);
    const liveResultRepo = new InMemoryLiveResultRepository([]);

    const result = await getRankHistory(
      communityRepo,
      betRepo,
      tournamentRepo,
      liveResultRepo,
      mockGetUserName,
      {
        viewerId: "user-alice", // Import Owner viewer
        communitySlug: "champs",
      },
    );

    expect(result.isOk()).toBe(true);
    const response = result._unsafeUnwrap();
    expect(response.bets[0].label).toEqual({
      obfuscated: false,
      value: "123 | Alice Smith",
    });
  });
});
