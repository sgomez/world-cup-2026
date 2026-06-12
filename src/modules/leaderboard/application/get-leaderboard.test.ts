import { describe, expect, it } from "vitest";
import { Bet } from "../../bet/domain/bet";
import { BettingWindow } from "../../bet/domain/betting-window";
import { InMemoryBetRepository } from "../../bet/infrastructure/in-memory-bet-repository";
import { Community } from "../../community/domain/community";
import { InMemoryCommunityRepository } from "../../community/infrastructure/in-memory-community-repository";
import { InMemoryLiveResultRepository } from "../../live/infrastructure/in-memory-live-result-repository";
import { Tournament } from "../../tournament/domain/tournament";
import { InMemoryTournamentRepository } from "../../tournament/infrastructure/in-memory-tournament-repository";
import { getLeaderboard } from "./get-leaderboard";

describe("GetLeaderboard Application Service Integration Tests", () => {
  const deadline = new Date("2026-06-15T18:00:00Z");
  const now = new Date("2026-06-16T12:00:00Z"); // After deadline
  const window = new BettingWindow(deadline);

  const mockPredictions = {
    groupOrders: {
      A: ["usa", "wal", "irn", "eng"],
    },
    thirdPlaceOrder: ["3rd-a"],
  };

  const mockGetUserName = async (userId: string) => {
    if (userId === "user-alice") return "Alice";
    if (userId === "user-bob") return "Bob";
    return null;
  };

  it("should successfully calculate the leaderboard for community members", async () => {
    const community = Community.fromState({
      id: "comm-1",
      name: "Champs",
      slug: "champs",
      ownerId: "user-alice",
      inviteToken: "token-123",
      memberIds: ["user-alice", "user-bob"],
    });

    const aliceBet = Bet.fromState({
      id: "bet-alice",
      userId: "user-alice",
      label: "Alice Bet",
      status: "closed",
      groupPredictions: mockPredictions,
      knockoutWinners: {},
      createdAt: new Date("2026-06-08T12:00:00Z"),
    });

    const bobBet = Bet.fromState({
      id: "bet-bob",
      userId: "user-bob",
      label: "Bob Bet",
      status: "closed",
      groupPredictions: mockPredictions,
      knockoutWinners: {},
      createdAt: new Date("2026-06-08T11:00:00Z"),
    });

    const communityRepo = new InMemoryCommunityRepository([community]);
    const betRepo = new InMemoryBetRepository([aliceBet, bobBet]);
    const tournamentRepo = new InMemoryTournamentRepository(
      Tournament.createDefault(),
    );
    const liveResultRepo = new InMemoryLiveResultRepository();

    const result = await getLeaderboard(
      communityRepo,
      betRepo,
      tournamentRepo,
      liveResultRepo,
      mockGetUserName,
      {
        viewerId: "user-alice",
        communitySlug: "champs",
        window,
        now,
      },
    );

    expect(result.isOk()).toBe(true);
    const leaderboard = result._unsafeUnwrap();
    expect(leaderboard.entries).toHaveLength(2);
    // Bob should be first due to earlier creation time since points are equal (0 points post-deadline here)
    expect(leaderboard.entries[0].userId).toBe("user-bob");
    expect(leaderboard.entries[0].userName).toBe("Bob");
    expect(leaderboard.entries[1].userId).toBe("user-alice");
    expect(leaderboard.entries[1].userName).toBe("Alice");
  });

  it("should ignore draft bets", async () => {
    const community = Community.fromState({
      id: "comm-1",
      name: "Champs",
      slug: "champs",
      ownerId: "user-alice",
      inviteToken: "token-123",
      memberIds: ["user-alice", "user-bob"],
    });

    const aliceBet = Bet.fromState({
      id: "bet-alice",
      userId: "user-alice",
      label: "Alice Bet",
      status: "closed",
      groupPredictions: mockPredictions,
      knockoutWinners: {},
      createdAt: new Date("2026-06-08T12:00:00Z"),
    });

    const bobDraftBet = Bet.fromState({
      id: "bet-bob",
      userId: "user-bob",
      label: "Bob Bet",
      status: "draft",
      groupPredictions: mockPredictions,
      knockoutWinners: {},
      createdAt: new Date("2026-06-08T11:00:00Z"),
    });

    const communityRepo = new InMemoryCommunityRepository([community]);
    const betRepo = new InMemoryBetRepository([aliceBet, bobDraftBet]);
    const tournamentRepo = new InMemoryTournamentRepository(
      Tournament.createDefault(),
    );
    const liveResultRepo = new InMemoryLiveResultRepository();

    const result = await getLeaderboard(
      communityRepo,
      betRepo,
      tournamentRepo,
      liveResultRepo,
      mockGetUserName,
      {
        viewerId: "user-alice",
        communitySlug: "champs",
        window,
        now,
      },
    );

    expect(result.isOk()).toBe(true);
    const leaderboard = result._unsafeUnwrap();
    expect(leaderboard.entries).toHaveLength(1);
    expect(leaderboard.entries[0].userId).toBe("user-alice");
  });

  it("should return NOT_FOUND error if community is not found", async () => {
    const communityRepo = new InMemoryCommunityRepository([]);
    const betRepo = new InMemoryBetRepository([]);
    const tournamentRepo = new InMemoryTournamentRepository(null);
    const liveResultRepo = new InMemoryLiveResultRepository([]);

    const result = await getLeaderboard(
      communityRepo,
      betRepo,
      tournamentRepo,
      liveResultRepo,
      mockGetUserName,
      {
        viewerId: "user-alice",
        communitySlug: "non-existent",
        window,
        now,
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

    const result = await getLeaderboard(
      communityRepo,
      betRepo,
      tournamentRepo,
      liveResultRepo,
      mockGetUserName,
      {
        viewerId: "user-outsider",
        communitySlug: "champs",
        window,
        now,
      },
    );

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("FORBIDDEN");
  });
});
