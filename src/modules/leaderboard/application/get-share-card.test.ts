import { describe, expect, it } from "vitest";
import { Bet } from "../../bet/domain/bet";
import { BettingWindow } from "../../bet/domain/betting-window";
import { InMemoryBetRepository } from "../../bet/infrastructure/in-memory-bet-repository";
import { Community } from "../../community/domain/community";
import { InMemoryCommunityRepository } from "../../community/infrastructure/in-memory-community-repository";
import { InMemoryLiveResultRepository } from "../../live/infrastructure/in-memory-live-result-repository";
import { Tournament } from "../../tournament/domain/tournament";
import { InMemoryTournamentRepository } from "../../tournament/infrastructure/in-memory-tournament-repository";
import { getShareCard } from "./get-share-card";

describe("GetShareCard Application Service Tests", () => {
  const deadline = new Date("2026-06-11T19:00:00Z");
  const now = new Date("2026-06-16T12:00:00Z"); // After deadline
  const window = new BettingWindow(deadline);

  const mockPredictions = {
    groupOrders: {
      A: ["usa", "wal", "irn", "eng"],
    },
    thirdPlaceOrder: ["3rd-a"],
  };

  it("should return card data for a native community", async () => {
    const community = Community.fromState({
      id: "comm-1",
      name: "Champs",
      slug: "champs",
      ownerId: "user-alice",
      inviteToken: "token-123",
      memberIds: ["user-alice", "user-bob"],
      imported: false,
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

    const result = await getShareCard(
      communityRepo,
      betRepo,
      tournamentRepo,
      liveResultRepo,
      {
        communitySlug: "champs",
        window,
        now,
      },
    );

    expect(result.isOk()).toBe(true);
    const card = result._unsafeUnwrap();
    expect(card.communityName).toBe("Champs");
    expect(card.totalBets).toBe(2);
    expect(card.entries).toHaveLength(2);
  });

  it("should return NOT_FOUND for a non-existent community", async () => {
    const communityRepo = new InMemoryCommunityRepository([]);
    const betRepo = new InMemoryBetRepository([]);
    const tournamentRepo = new InMemoryTournamentRepository(null);
    const liveResultRepo = new InMemoryLiveResultRepository([]);

    const result = await getShareCard(
      communityRepo,
      betRepo,
      tournamentRepo,
      liveResultRepo,
      {
        communitySlug: "non-existent",
        window,
        now,
      },
    );

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("NOT_FOUND");
  });

  it("should return NOT_FOUND for an imported community", async () => {
    const community = Community.fromState({
      id: "comm-1",
      name: "Imported Community",
      slug: "imported-comm",
      ownerId: "user-alice",
      inviteToken: "token-123",
      memberIds: ["user-alice"],
      imported: true,
    });

    const communityRepo = new InMemoryCommunityRepository([community]);
    const betRepo = new InMemoryBetRepository([]);
    const tournamentRepo = new InMemoryTournamentRepository(null);
    const liveResultRepo = new InMemoryLiveResultRepository([]);

    const result = await getShareCard(
      communityRepo,
      betRepo,
      tournamentRepo,
      liveResultRepo,
      {
        communitySlug: "imported-comm",
        window,
        now,
      },
    );

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("NOT_FOUND");
  });

  it("should include bet labels and scores but no owner names", async () => {
    const community = Community.fromState({
      id: "comm-1",
      name: "Champs",
      slug: "champs",
      ownerId: "user-alice",
      inviteToken: "token-123",
      memberIds: ["user-alice"],
      imported: false,
    });

    const aliceBet = Bet.fromState({
      id: "bet-alice",
      userId: "user-alice",
      label: "Alice Bet Label",
      status: "closed",
      groupPredictions: mockPredictions,
      knockoutWinners: {},
      createdAt: new Date("2026-06-08T12:00:00Z"),
    });

    const communityRepo = new InMemoryCommunityRepository([community]);
    const betRepo = new InMemoryBetRepository([aliceBet]);
    const tournamentRepo = new InMemoryTournamentRepository(null);
    const liveResultRepo = new InMemoryLiveResultRepository([]);

    const result = await getShareCard(
      communityRepo,
      betRepo,
      tournamentRepo,
      liveResultRepo,
      {
        communitySlug: "champs",
        window,
        now,
      },
    );

    expect(result.isOk()).toBe(true);
    const card = result._unsafeUnwrap();
    expect(card.entries).toHaveLength(1);

    const entry = card.entries[0];
    expect(entry.label).toBe("Alice Bet Label");
    expect(entry.points).toBeDefined();
    expect(entry.rank).toBeDefined();
    // No owner name field
    expect((entry as Record<string, unknown>).ownerName).toBeUndefined();
    expect((entry as Record<string, unknown>).userName).toBeUndefined();
    expect((entry as Record<string, unknown>).userId).toBeUndefined();
  });

  it("should ignore draft bets", async () => {
    const community = Community.fromState({
      id: "comm-1",
      name: "Champs",
      slug: "champs",
      ownerId: "user-alice",
      inviteToken: "token-123",
      memberIds: ["user-alice", "user-bob"],
      imported: false,
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
      label: "Bob Draft Bet",
      status: "draft",
      groupPredictions: mockPredictions,
      knockoutWinners: {},
      createdAt: new Date("2026-06-08T11:00:00Z"),
    });

    const communityRepo = new InMemoryCommunityRepository([community]);
    const betRepo = new InMemoryBetRepository([aliceBet, bobDraftBet]);
    const tournamentRepo = new InMemoryTournamentRepository(null);
    const liveResultRepo = new InMemoryLiveResultRepository([]);

    const result = await getShareCard(
      communityRepo,
      betRepo,
      tournamentRepo,
      liveResultRepo,
      {
        communitySlug: "champs",
        window,
        now,
      },
    );

    expect(result.isOk()).toBe(true);
    const card = result._unsafeUnwrap();
    expect(card.entries).toHaveLength(1);
    expect(card.entries[0].label).toBe("Alice Bet");
  });
});
