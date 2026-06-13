import { describe, expect, it } from "vitest";
import { InMemoryBetRepository } from "@/modules/bet/infrastructure/in-memory-bet-repository";
import { InMemoryCommunityRepository } from "@/modules/community/infrastructure/in-memory-community-repository";
import { Tournament } from "@/modules/tournament/domain/tournament";
import { User } from "@/modules/user/domain/user";
import { InMemoryUserRepository } from "@/modules/user/infrastructure/in-memory-user-repository";
import { createTestContainer } from "./container";

describe("Container - bets() accessor", () => {
  const OWNER_ID = "user-123";

  function completeWinners(): Record<string, string> {
    return Object.fromEntries(
      Array.from({ length: 32 }, (_, i) => [`M${i}`, `team-${i}`]),
    );
  }

  it("performs create, find, list, and close operations end-to-end", async () => {
    const container = createTestContainer();

    // 1. Create a bet
    const createResult = await container.bets().create({
      userId: OWNER_ID,
      label: "My test bet",
      limit: 3,
    });
    expect(createResult.isOk()).toBe(true);
    const createdBet = createResult._unsafeUnwrap();
    expect(createdBet.label).toBe("My test bet");
    expect(createdBet.status).toBe("draft");

    // 2. Find the bet by id
    const foundBet = await container.bets().findById(createdBet.id);
    expect(foundBet).not.toBeNull();
    expect(foundBet?.id).toBe(createdBet.id);

    // 3. List summaries
    const summaries = await container.bets().listSummaries(OWNER_ID);
    expect(summaries.length).toBe(1);
    expect(summaries[0].id).toBe(createdBet.id);
    expect(summaries[0].label).toBe("My test bet");

    // 3.5. Test deadline helpers
    expect(container.bets().isPastDeadline()).toBe(false);
    expect(container.bets().deadline).toBeInstanceOf(Date);

    // 4. Close the bet should fail initially because predictions are incomplete
    const closeResultFail = await container.bets().close({
      betId: createdBet.id,
      userId: OWNER_ID,
    });
    expect(closeResultFail.isErr()).toBe(true);
    expect(closeResultFail._unsafeUnwrapErr().code).toBe(
      "INCOMPLETE_PREDICTIONS",
    );

    // Update predictions to complete
    const updateResult = await container.bets().updatePredictions({
      betId: createdBet.id,
      userId: OWNER_ID,
      groupPredictions: null,
      knockoutWinners: completeWinners(),
    });
    expect(updateResult.isOk()).toBe(true);

    // Close the bet should now succeed
    const closeResultSuccess = await container.bets().close({
      betId: createdBet.id,
      userId: OWNER_ID,
    });
    expect(closeResultSuccess.isOk()).toBe(true);

    const closedBet = await container.bets().findById(createdBet.id);
    expect(closedBet?.status).toBe("closed");
  });
});

describe("Container - communities() accessor", () => {
  it("performs community creation, search, and member actions", async () => {
    const container = createTestContainer();

    const createResult = await container.communities().create({
      ownerId: "owner-1",
      name: "My Community",
      inviteToken: "token-abc",
    });
    expect(createResult.isOk()).toBe(true);
    const comm = createResult._unsafeUnwrap();
    expect(comm.name).toBe("My Community");
    expect(comm.slug).toBe("my-community");

    const found = await container.communities().findBySlug("my-community");
    expect(found).not.toBeNull();
    expect(found?.name).toBe("My Community");

    const joinResult = await container.communities().join({
      userId: "user-2",
      inviteToken: "token-abc",
    });
    expect(joinResult.isOk()).toBe(true);
  });
});

describe("Container - tournament() and live() accessors", () => {
  it("interacts with tournament settings and live matches", async () => {
    const container = createTestContainer();

    const tournament = await container.tournament().get();
    expect(tournament).toBeNull(); // default is null in InMemoryTournamentRepository before seeding

    // save tournament
    const defaultTournament = Tournament.createDefault();
    const saveResult = await container.tournament().save(defaultTournament);
    expect(saveResult.isOk()).toBe(true);

    const saved = await container.tournament().get();
    expect(saved?.id).toBe("singleton");

    // Live result
    const liveRes = await container.live().findAll();
    expect(liveRes.length).toBe(0);

    const upsertRes = await container.live().upsert({
      num: 1,
      status: "live",
      goals1: 2,
      goals2: 1,
      allowCreate: true,
    });
    expect(upsertRes.isOk()).toBe(true);

    const foundLive = await container.live().findByNum(1);
    expect(foundLive?.goals1).toBe(2);
  });
});

describe("Container - users() accessor", () => {
  it("interacts with users", async () => {
    const user = User.create({
      id: "user-1",
      email: "user@example.com",
      name: "Old Name",
      emailVerified: true,
      image: null,
    })._unsafeUnwrap();

    const userRepo = new InMemoryUserRepository([user]);
    const container = createTestContainer({ userRepo });

    const updateRes = await container.users().updateProfile({
      userId: "user-1",
      name: "New Name",
      image: "https://example.com/image.png",
    });
    expect(updateRes.isOk()).toBe(true);
    expect(updateRes._unsafeUnwrap().name).toBe("New Name");

    const found = await container.users().findById("user-1");
    expect(found?.name).toBe("New Name");
  });
});

describe("Container - leaderboard() accessor and getNameResolver", () => {
  it("should successfully calculate the leaderboard and resolve names", async () => {
    const user1 = User.create({
      id: "user-alice",
      email: "alice@example.com",
      name: "Alice",
      emailVerified: true,
      image: null,
    })._unsafeUnwrap();
    const user2 = User.create({
      id: "user-bob",
      email: "bob@example.com",
      name: "Bob",
      emailVerified: true,
      image: null,
    })._unsafeUnwrap();

    const userRepo = new InMemoryUserRepository([user1, user2]);
    const communityRepo = new InMemoryCommunityRepository();
    const betRepo = new InMemoryBetRepository();

    const container = createTestContainer({ userRepo, communityRepo, betRepo });

    // Seed community
    const createCommResult = await container.communities().create({
      ownerId: "user-alice",
      name: "Champs",
      inviteToken: "token-123",
    });
    expect(createCommResult.isOk()).toBe(true);
    createCommResult._unsafeUnwrap();

    // Join bob
    const joinResult = await container.communities().join({
      userId: "user-bob",
      inviteToken: "token-123",
    });
    expect(joinResult.isOk()).toBe(true);

    // Seed nameResolver
    const initialCache = new Map<string, string | null>([
      ["user-alice", "Alice"],
    ]);
    const nameResolver = container.getNameResolver(initialCache);

    // Test name resolver
    const nameAlice = await nameResolver("user-alice");
    expect(nameAlice).toBe("Alice"); // from cache
    const nameBob = await nameResolver("user-bob");
    expect(nameBob).toBe("Bob"); // resolved from repo

    // Get leaderboard
    const leaderboardResult = await container.leaderboard().get(
      {
        viewerId: "user-alice",
        communitySlug: "champs",
      },
      nameResolver,
    );
    expect(leaderboardResult.isOk()).toBe(true);
  });

  it("defaultNameResolver should be uncached and reflect profile name changes", async () => {
    const user = User.create({
      id: "user-alice",
      email: "alice@example.com",
      name: "Alice",
      emailVerified: true,
      image: null,
    })._unsafeUnwrap();

    const userRepo = new InMemoryUserRepository([user]);
    const communityRepo = new InMemoryCommunityRepository();
    const betRepo = new InMemoryBetRepository();
    const container = createTestContainer({ userRepo, communityRepo, betRepo });

    // Seed community
    await container.communities().create({
      ownerId: "user-alice",
      name: "Champs",
      inviteToken: "token-123",
    });

    // Seed a bet
    const createResult = await container.bets().create({
      userId: "user-alice",
      label: "Test Bet",
      limit: 3,
    });
    const bet = createResult._unsafeUnwrap();

    // Complete predictions and close the bet to make it peer-visible
    const completeWinners = () =>
      Object.fromEntries(
        Array.from({ length: 32 }, (_, i) => [`M${i}`, `team-${i}`]),
      );
    await container.bets().updatePredictions({
      betId: bet.id,
      userId: "user-alice",
      groupPredictions: null,
      knockoutWinners: completeWinners(),
    });
    await container.bets().close({
      betId: bet.id,
      userId: "user-alice",
    });

    // First lookup using default resolver
    const peerBetResult1 = await container.bets().getPeerBet({
      viewerId: "user-alice",
      communitySlug: "champs",
      betId: bet.id,
    });
    expect(peerBetResult1.isOk()).toBe(true);
    expect(peerBetResult1._unsafeUnwrap().ownerName).toBe("Alice");

    // Update profile
    await container.users().updateProfile({
      userId: "user-alice",
      name: "Alice Updated",
      image: null,
    });

    // Second lookup using default resolver should return the new name
    const peerBetResult2 = await container.bets().getPeerBet({
      viewerId: "user-alice",
      communitySlug: "champs",
      betId: bet.id,
    });
    expect(peerBetResult2.isOk()).toBe(true);
    expect(peerBetResult2._unsafeUnwrap().ownerName).toBe("Alice Updated");
  });
});
