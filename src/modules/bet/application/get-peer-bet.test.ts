import { describe, expect, it } from "vitest";
import { Community } from "../../community/domain/community";
import { InMemoryCommunityRepository } from "../../community/infrastructure/in-memory-community-repository";
import { Bet } from "../domain/bet";
import { BettingWindow } from "../domain/betting-window";
import { InMemoryBetRepository } from "../infrastructure/in-memory-bet-repository";
import { getPeerBet } from "./get-peer-bet";

const DEADLINE = new Date("2026-06-11T19:00:00Z");
const BEFORE = new Date("2026-06-10T00:00:00Z");
const AFTER = new Date("2026-06-12T00:00:00Z");
const WINDOW = new BettingWindow(DEADLINE);

function createTestCommunity(overrides: Partial<any> = {}): Community {
  return Community.fromState({
    id: "comm-1",
    name: "Our Community",
    slug: "our-community",
    ownerId: "owner-1",
    inviteToken: "token-1",
    memberIds: ["viewer-1", "owner-1"],
    ...overrides,
  });
}

function createTestBet(overrides: Partial<any> = {}): Bet {
  return Bet.fromState({
    id: "bet-1",
    userId: "owner-1",
    status: "closed",
    label: "My Great Bet",
    groupPredictions: null,
    knockoutWinners: {},
    ...overrides,
  });
}

describe("getPeerBet query service", () => {
  const mockGetUserName = async (userId: string) => {
    if (userId === "owner-1") return "Owner Name";
    return null;
  };

  it("returns NOT_FOUND if the community does not exist", async () => {
    const betRepo = new InMemoryBetRepository([createTestBet()]);
    const communityRepo = new InMemoryCommunityRepository();

    const result = await getPeerBet(betRepo, communityRepo, mockGetUserName, {
      viewerId: "viewer-1",
      communitySlug: "non-existent",
      betId: "bet-1",
      window: WINDOW,
      now: BEFORE,
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("NOT_FOUND");
  });

  it("returns FORBIDDEN if the viewer is not a member of the community", async () => {
    const betRepo = new InMemoryBetRepository([createTestBet()]);
    const communityRepo = new InMemoryCommunityRepository([
      createTestCommunity({ memberIds: ["owner-1"] }),
    ]);

    const result = await getPeerBet(betRepo, communityRepo, mockGetUserName, {
      viewerId: "viewer-1",
      communitySlug: "our-community",
      betId: "bet-1",
      window: WINDOW,
      now: BEFORE,
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("FORBIDDEN");
  });

  it("returns NOT_FOUND if the bet does not exist", async () => {
    const betRepo = new InMemoryBetRepository();
    const communityRepo = new InMemoryCommunityRepository([
      createTestCommunity(),
    ]);

    const result = await getPeerBet(betRepo, communityRepo, mockGetUserName, {
      viewerId: "viewer-1",
      communitySlug: "our-community",
      betId: "missing-bet",
      window: WINDOW,
      now: BEFORE,
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("NOT_FOUND");
  });

  it("returns FORBIDDEN if the bet owner is not a member of the community", async () => {
    const betRepo = new InMemoryBetRepository([createTestBet()]);
    const communityRepo = new InMemoryCommunityRepository([
      createTestCommunity({ memberIds: ["viewer-1"] }),
    ]);

    const result = await getPeerBet(betRepo, communityRepo, mockGetUserName, {
      viewerId: "viewer-1",
      communitySlug: "our-community",
      betId: "bet-1",
      window: WINDOW,
      now: BEFORE,
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("FORBIDDEN");
  });

  it("returns FORBIDDEN if the bet status is draft", async () => {
    const betRepo = new InMemoryBetRepository([
      createTestBet({ status: "draft" }),
    ]);
    const communityRepo = new InMemoryCommunityRepository([
      createTestCommunity(),
    ]);

    const result = await getPeerBet(betRepo, communityRepo, mockGetUserName, {
      viewerId: "viewer-1",
      communitySlug: "our-community",
      betId: "bet-1",
      window: WINDOW,
      now: BEFORE,
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("FORBIDDEN");
  });

  it("returns summary visibility DTO when accessed before the deadline for closed bets", async () => {
    const betRepo = new InMemoryBetRepository([createTestBet()]);
    const communityRepo = new InMemoryCommunityRepository([
      createTestCommunity(),
    ]);

    const result = await getPeerBet(betRepo, communityRepo, mockGetUserName, {
      viewerId: "viewer-1",
      communitySlug: "our-community",
      betId: "bet-1",
      window: WINDOW,
      now: BEFORE,
    });

    expect(result.isOk()).toBe(true);
    const value = result._unsafeUnwrap();
    expect(value.visibility).toBe("summary");
    expect(value.ownerName).toBe("Owner Name");
    expect(value.communityName).toBe("Our Community");
    expect(value.bet.label).toBe("My Great Bet");
  });

  it("returns full visibility DTO when accessed after the deadline for closed bets", async () => {
    const betRepo = new InMemoryBetRepository([createTestBet()]);
    const communityRepo = new InMemoryCommunityRepository([
      createTestCommunity(),
    ]);

    const result = await getPeerBet(betRepo, communityRepo, mockGetUserName, {
      viewerId: "viewer-1",
      communitySlug: "our-community",
      betId: "bet-1",
      window: WINDOW,
      now: AFTER,
    });

    expect(result.isOk()).toBe(true);
    const value = result._unsafeUnwrap();
    expect(value.visibility).toBe("full");
    expect(value.ownerName).toBe("Owner Name");
    expect(value.communityName).toBe("Our Community");
  });
});
