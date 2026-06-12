import { describe, expect, it } from "vitest";
import { createInitialState } from "@/lib/prediction-state";
import { extractScoreableContent, toScoreableContent } from "@/lib/scoring";
import { Bet } from "@/modules/bet/domain/bet";
import { BettingWindow } from "@/modules/bet/domain/betting-window";
import { Leaderboard } from "./leaderboard";

describe("Leaderboard Bounded Context - Domain Aggregate Root", () => {
  const deadline = new Date("2026-06-15T18:00:00Z");
  const beforeDeadline = new Date("2026-06-14T12:00:00Z");
  const afterDeadline = new Date("2026-06-16T12:00:00Z");
  const window = new BettingWindow(deadline);

  // Helper to generate a dummy/valid ScoreableContent matching default prediction state
  const { knockoutMatches: defaultMatches } = createInitialState(null, null);
  const defaultContent = extractScoreableContent(defaultMatches);
  const defaultTeams = Array.from(defaultContent.R32);

  // Correct actual result matching the first 3 teams of R32
  const actualResultArrays = {
    R32: defaultTeams.slice(0, 3),
    R16: [],
    QF: [],
    SF: [],
    F: [],
    champion: null,
    thirdPlace: null,
  };
  const actualResult = toScoreableContent(actualResultArrays);

  // Non-null mock predictions to test selections hiding/visibility
  const mockPredictions = {
    groupOrders: {
      A: ["usa", "wal", "irn", "eng"],
    },
    thirdPlaceOrder: ["3rd-a"],
  };

  it("should handle empty inputs and return an empty leaderboard", () => {
    const leaderboard = Leaderboard.create(
      [],
      actualResult,
      window,
      beforeDeadline,
      null,
      false,
    );

    expect(leaderboard.entries).toEqual([]);
    expect(leaderboard.groupedEntries).toEqual([]);
  });

  it("should completely exclude draft bets from the leaderboard", () => {
    const draftBet = Bet.fromState({
      id: "bet-draft",
      userId: "user-1",
      label: "My Draft Bet",
      status: "draft",
      groupPredictions: mockPredictions,
      knockoutWinners: {},
      createdAt: new Date("2026-06-08T12:00:00Z"),
    });

    const leaderboard = Leaderboard.create(
      [{ bet: draftBet, ownerName: "Alice" }],
      actualResult,
      window,
      beforeDeadline,
      null,
      false,
    );

    expect(leaderboard.entries).toHaveLength(0);
    expect(leaderboard.groupedEntries).toHaveLength(0);
  });

  it("should assign co-winner positions (shared rank) and perform stable tiebreaking based on createdAt ascending", () => {
    // Both Alice and Bob will have 0 points before deadline, but Bob has an earlier createdAt
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
      createdAt: new Date("2026-06-08T11:00:00Z"), // Earlier
    });

    const leaderboard = Leaderboard.create(
      [
        { bet: aliceBet, ownerName: "Alice" },
        { bet: bobBet, ownerName: "Bob" },
      ],
      actualResult,
      window,
      beforeDeadline,
      null,
      false,
    );

    const entries = leaderboard.entries;
    expect(entries).toHaveLength(2);

    // Bob should be ranked first in sorted entries due to stable tiebreaking (earlier createdAt)
    expect(entries[0].userName).toBe("Bob");
    expect(entries[0].rank).toBe(1);

    expect(entries[1].userName).toBe("Alice");
    expect(entries[1].rank).toBe(1); // Shares the same rank because points are tied (both 0)

    // Verify grouped entries
    const grouped = leaderboard.groupedEntries;
    expect(grouped).toHaveLength(1);
    expect(grouped[0].rank).toBe(1);
    expect(grouped[0].entries).toHaveLength(2);
    expect(grouped[0].entries.map((e) => e.userName)).toEqual(["Bob", "Alice"]);
  });

  describe("Pre-deadline secrecy rules (window is open)", () => {
    // Alice's predictions are null, which falls back to default prediction state.
    // Since default predictions match default matches, Alice will score points when they are not hidden.
    const aliceBet = Bet.fromState({
      id: "bet-alice",
      userId: "user-alice",
      label: "Alice Bet",
      status: "closed",
      groupPredictions: null,
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

    it("should calculate correct score and show predictions for the viewer's own bets, but zero out and hide predictions for peer bets", () => {
      const leaderboard = Leaderboard.create(
        [
          { bet: aliceBet, ownerName: "Alice" },
          { bet: bobBet, ownerName: "Bob" },
        ],
        actualResult,
        window,
        beforeDeadline,
        "user-alice", // Alice is viewing
        false,
      );

      const entries = leaderboard.entries;
      const aliceEntry = entries.find((e) => e.userName === "Alice");
      const bobEntry = entries.find((e) => e.userName === "Bob");

      expect(aliceEntry).toBeDefined();
      expect(aliceEntry?.points).toBe(9); // Alice gets actual points (3 matched R32 teams * 3 points = 9)
      expect(aliceEntry?.selectionsHidden).toBe(false);
      expect(aliceEntry?.bet?.groupPredictions).toBeNull(); // It was null to begin with, which is fine, but it is not redacted

      expect(bobEntry).toBeDefined();
      expect(bobEntry?.points).toBe(0); // Bob (peer) gets zeroed out points
      expect(bobEntry?.selectionsHidden).toBe(true);
      expect(bobEntry?.bet?.groupPredictions).toBeNull(); // Redacted to null
      expect(bobEntry?.bet?.knockoutWinners).toEqual({});
    });

    it("should zero out points and hide selections for all bets if viewer is null (anonymous)", () => {
      const leaderboard = Leaderboard.create(
        [
          { bet: aliceBet, ownerName: "Alice" },
          { bet: bobBet, ownerName: "Bob" },
        ],
        actualResult,
        window,
        beforeDeadline,
        null, // No logged-in viewer
        false,
      );

      for (const entry of leaderboard.entries) {
        expect(entry.points).toBe(0);
        expect(entry.selectionsHidden).toBe(true);
        expect(entry.bet?.groupPredictions).toBeNull();
        expect(entry.bet?.knockoutWinners).toEqual({});
      }
    });
  });

  describe("Post-deadline visibility rules (window is closed)", () => {
    it("should compute real scores and show selections for all bets, regardless of viewer", () => {
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

      const leaderboard = Leaderboard.create(
        [
          { bet: aliceBet, ownerName: "Alice" },
          { bet: bobBet, ownerName: "Bob" },
        ],
        actualResult,
        window,
        afterDeadline,
        "user-alice", // Alice is viewing post-deadline
        false,
      );

      for (const entry of leaderboard.entries) {
        expect(entry.selectionsHidden).toBe(false); // No selections hidden
        expect(entry.bet?.groupPredictions).toEqual(mockPredictions); // Predictions are visible (not null)
      }
    });

    it("should handle null actualResult by defaulting to 0 points for everyone", () => {
      const aliceBet = Bet.fromState({
        id: "bet-alice",
        userId: "user-alice",
        label: "Alice Bet",
        status: "closed",
        groupPredictions: mockPredictions,
        knockoutWinners: {},
        createdAt: new Date("2026-06-08T12:00:00Z"),
      });

      const leaderboard = Leaderboard.create(
        [{ bet: aliceBet, ownerName: "Alice" }],
        null, // No actual result yet
        window,
        afterDeadline,
        null,
        false,
      );

      expect(leaderboard.entries[0].points).toBe(0);
      expect(leaderboard.entries[0].selectionsHidden).toBe(false);
    });
  });

  describe("Cup award gating rules", () => {
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

    it("should withhold Cup award if the competition is not ended, even for rank 1", () => {
      const leaderboard = Leaderboard.create(
        [
          { bet: aliceBet, ownerName: "Alice" },
          { bet: bobBet, ownerName: "Bob" },
        ],
        actualResult,
        window,
        afterDeadline,
        null,
        false, // Competition has NOT ended
      );

      for (const entry of leaderboard.entries) {
        expect(entry.hasCup).toBe(false);
      }
    });

    it("should award Cup to the top-placed bet(s) (rank === 1) once the competition has ended", () => {
      const leaderboard = Leaderboard.create(
        [
          { bet: aliceBet, ownerName: "Alice" },
          { bet: bobBet, ownerName: "Bob" },
        ],
        actualResult,
        window,
        afterDeadline,
        null,
        true, // Competition HAS ended
      );

      // Both Alice and Bob share rank 1 in this setup (both have same points), so both get the Cup
      expect(leaderboard.entries[0].rank).toBe(1);
      expect(leaderboard.entries[0].hasCup).toBe(true);

      expect(leaderboard.entries[1].rank).toBe(1);
      expect(leaderboard.entries[1].hasCup).toBe(true);
    });

    it("should only award Cup to rank 1 when there is a clear leader", () => {
      // Alice has groupPredictions=null (defaults to default groups, matching R32 occupant teams -> 9 points)
      const aliceBet = Bet.fromState({
        id: "bet-alice",
        userId: "user-alice",
        label: "Alice Bet",
        status: "closed",
        groupPredictions: null,
        knockoutWinners: {},
        createdAt: new Date("2026-06-08T12:00:00Z"),
      });

      // Charlie has groupPredictions with non-matching teams -> 0 points
      const charlieBet = Bet.fromState({
        id: "bet-charlie",
        userId: "user-charlie",
        label: "Charlie Bet",
        status: "closed",
        groupPredictions: {
          groupOrders: {
            A: ["xxx1", "xxx2", "xxx3", "xxx4"],
          },
          thirdPlaceOrder: [],
        },
        knockoutWinners: {},
        createdAt: new Date("2026-06-08T13:00:00Z"),
      });

      const leaderboard = Leaderboard.create(
        [
          { bet: aliceBet, ownerName: "Alice" },
          { bet: charlieBet, ownerName: "Charlie" },
        ],
        actualResult,
        window,
        afterDeadline,
        null,
        true, // Competition HAS ended
      );

      const aliceEntry = leaderboard.entries.find(
        (e) => e.userName === "Alice",
      );
      const charlieEntry = leaderboard.entries.find(
        (e) => e.userName === "Charlie",
      );

      expect(aliceEntry?.rank).toBe(1);
      expect(aliceEntry?.hasCup).toBe(true);

      expect(charlieEntry?.rank).toBe(2);
      expect(charlieEntry?.hasCup).toBe(false);
    });
  });
});
