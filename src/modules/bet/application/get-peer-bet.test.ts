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

function createTestCommunity(
  overrides: Partial<Parameters<typeof Community.fromState>[0]> = {},
): Community {
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

function createTestBet(
  overrides: Partial<Parameters<typeof Bet.fromState>[0]> = {},
): Bet {
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
    return userId + " Name";
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
    expect(value.bet.label).toEqual({
      obfuscated: false,
      value: "My Great Bet",
    });
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

  it("returns obfuscated label for non-owner in an imported community", async () => {
    const betRepo = new InMemoryBetRepository([
      createTestBet({ label: "123 | David" }),
    ]);
    const communityRepo = new InMemoryCommunityRepository([
      createTestCommunity({
        imported: true,
        ownerId: "owner-1",
        memberIds: ["viewer-1", "owner-1"],
      }),
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
    expect(value.bet.label).toEqual({
      obfuscated: true,
      num: "123",
      head: "Da",
      tail: "id",
      middleLen: 1,
    });
  });

  it("returns full label for owner in an imported community", async () => {
    const betRepo = new InMemoryBetRepository([
      createTestBet({ label: "123 | David" }),
    ]);
    const communityRepo = new InMemoryCommunityRepository([
      createTestCommunity({
        imported: true,
        ownerId: "owner-1",
        memberIds: ["viewer-1", "owner-1"],
      }),
    ]);

    const result = await getPeerBet(betRepo, communityRepo, mockGetUserName, {
      viewerId: "owner-1",
      communitySlug: "our-community",
      betId: "bet-1",
      window: WINDOW,
      now: AFTER,
    });

    expect(result.isOk()).toBe(true);
    const value = result._unsafeUnwrap();
    expect(value.bet.label).toEqual({
      obfuscated: false,
      value: "123 | David",
    });
  });

  it("returns FORBIDDEN in an imported community for any bet not owned by the Import Owner", async () => {
    const betRepo = new InMemoryBetRepository([
      createTestBet({
        id: "bet-not-owner",
        userId: "viewer-1",
        label: "Viewer Bet",
      }),
    ]);
    const communityRepo = new InMemoryCommunityRepository([
      createTestCommunity({
        imported: true,
        ownerId: "owner-1",
        memberIds: ["viewer-1", "owner-1"],
      }),
    ]);

    const result = await getPeerBet(betRepo, communityRepo, mockGetUserName, {
      viewerId: "viewer-1",
      communitySlug: "our-community",
      betId: "bet-not-owner",
      window: WINDOW,
      now: AFTER,
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("FORBIDDEN");
  });

  it("serves a bet owned by the Import Owner in an imported community", async () => {
    const betRepo = new InMemoryBetRepository([
      createTestBet({
        id: "bet-owner",
        userId: "owner-1",
        label: "123 | Owner Bet",
      }),
    ]);
    const communityRepo = new InMemoryCommunityRepository([
      createTestCommunity({
        imported: true,
        ownerId: "owner-1",
        memberIds: ["viewer-1", "owner-1"],
      }),
    ]);

    const result = await getPeerBet(betRepo, communityRepo, mockGetUserName, {
      viewerId: "viewer-1",
      communitySlug: "our-community",
      betId: "bet-owner",
      window: WINDOW,
      now: AFTER,
    });

    expect(result.isOk()).toBe(true);
    const value = result._unsafeUnwrap();
    expect(value.bet.id).toBe("bet-owner");
    expect(value.bet.label).toEqual({
      obfuscated: true,
      num: "123",
      head: "Ow",
      tail: "et",
      middleLen: 5,
    });
  });

  it("serves any member's bet in a native community (not imported)", async () => {
    const betRepo = new InMemoryBetRepository([
      createTestBet({
        id: "bet-member",
        userId: "viewer-2",
        label: "Member Bet",
      }),
    ]);
    const communityRepo = new InMemoryCommunityRepository([
      createTestCommunity({
        imported: false,
        ownerId: "owner-1",
        memberIds: ["viewer-1", "owner-1", "viewer-2"],
      }),
    ]);

    const result = await getPeerBet(betRepo, communityRepo, mockGetUserName, {
      viewerId: "viewer-1",
      communitySlug: "our-community",
      betId: "bet-member",
      window: WINDOW,
      now: AFTER,
    });

    expect(result.isOk()).toBe(true);
    const value = result._unsafeUnwrap();
    expect(value.bet.id).toBe("bet-member");
  });
});
