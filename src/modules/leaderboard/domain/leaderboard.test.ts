import { describe, expect, it } from "vitest";
import { Bet } from "@/modules/bet/domain/bet";
import { BettingWindow } from "@/modules/bet/domain/betting-window";
import { createInitialState } from "@/modules/bracket";
import {
  extractScoreableContent,
  type ScoreableContentArrays,
  toScoreableContent,
} from "@/modules/score";
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

  describe("Direct Bets support in Leaderboard", () => {
    const directPredictions: ScoreableContentArrays = {
      R32: defaultTeams.slice(0, 3), // matching R32 teams
      R16: [],
      QF: [],
      SF: [],
      F: [],
      champion: null,
      thirdPlace: null,
    };

    const directBet = Bet.fromState({
      id: "bet-direct",
      userId: "user-direct",
      label: "Direct Bet",
      status: "closed",
      groupPredictions: null,
      knockoutWinners: {},
      directPredictions,
      createdAt: new Date("2026-06-08T12:00:00Z"),
    });

    const bracketBetWithSameContent = Bet.fromState({
      id: "bet-bracket",
      userId: "user-bracket",
      label: "Bracket Bet",
      status: "closed",
      groupPredictions: null,
      knockoutWinners: {},
      createdAt: new Date("2026-06-08T11:00:00Z"), // Earlier
    });

    it("should compute score and rank a Direct Bet correctly alongside Bracket Bets", () => {
      const leaderboard = Leaderboard.create(
        [
          { bet: directBet, ownerName: "DirectOwner" },
          { bet: bracketBetWithSameContent, ownerName: "BracketOwner" },
        ],
        actualResult,
        window,
        afterDeadline,
        null,
        false,
      );

      expect(leaderboard.entries).toHaveLength(2);

      const directEntry = leaderboard.entries.find(
        (e) => e.userName === "DirectOwner",
      );
      const bracketEntry = leaderboard.entries.find(
        (e) => e.userName === "BracketOwner",
      );

      expect(directEntry).toBeDefined();
      expect(bracketEntry).toBeDefined();

      // Both should have 9 points
      expect(directEntry?.points).toBe(9);
      expect(bracketEntry?.points).toBe(9);

      // They should share the same rank (co-winner)
      expect(directEntry?.rank).toBe(1);
      expect(bracketEntry?.rank).toBe(1);

      // Stable ranking puts BracketOwner first due to earlier createdAt
      expect(leaderboard.entries[0].userName).toBe("BracketOwner");
      expect(leaderboard.entries[1].userName).toBe("DirectOwner");
    });

    it("should hide/redact directPredictions for Direct Bets when selections are hidden pre-deadline", () => {
      const leaderboard = Leaderboard.create(
        [{ bet: directBet, ownerName: "DirectOwner" }],
        actualResult,
        window,
        beforeDeadline,
        null,
        false,
      );

      const entry = leaderboard.entries[0];
      expect(entry.selectionsHidden).toBe(true);
      expect(entry.points).toBe(0);
      expect(entry.bet?.directPredictions).toBeNull();
    });

    it("should show/expose directPredictions for Direct Bets when selections are visible post-deadline", () => {
      const leaderboard = Leaderboard.create(
        [{ bet: directBet, ownerName: "DirectOwner" }],
        actualResult,
        window,
        afterDeadline,
        null,
        false,
      );

      const entry = leaderboard.entries[0];
      expect(entry.selectionsHidden).toBe(false);
      expect(entry.points).toBe(9);
      expect(entry.bet?.directPredictions).toEqual(directPredictions);
    });

    it("should update Direct Bet scores dynamically as live actualResults move", () => {
      const liveActualResultArrays = {
        R32: defaultTeams.slice(0, 2),
        R16: [],
        QF: [],
        SF: [],
        F: [],
        champion: null,
        thirdPlace: null,
      };
      const liveActualResult = toScoreableContent(liveActualResultArrays);

      const leaderboard = Leaderboard.create(
        [{ bet: directBet, ownerName: "DirectOwner" }],
        liveActualResult,
        window,
        afterDeadline,
        null,
        false,
      );

      expect(leaderboard.entries[0].points).toBe(6);
    });

    it("should award Cup correctly when tournament ends and a Direct Bet is co-winner", () => {
      const leaderboard = Leaderboard.create(
        [
          { bet: directBet, ownerName: "DirectOwner" },
          { bet: bracketBetWithSameContent, ownerName: "BracketOwner" },
        ],
        actualResult,
        window,
        afterDeadline,
        null,
        true,
      );

      const directEntry = leaderboard.entries.find(
        (e) => e.userName === "DirectOwner",
      );
      const bracketEntry = leaderboard.entries.find(
        (e) => e.userName === "BracketOwner",
      );

      expect(directEntry?.hasCup).toBe(true);
      expect(bracketEntry?.hasCup).toBe(true);
    });
  });

  describe("bestAndWorst(n)", () => {
    const window = new BettingWindow(new Date("2026-06-11T19:00:00Z"));
    const afterDeadline = new Date("2026-06-16T12:00:00Z");

    function makeBet(
      id: string,
      createdOffset = 0,
    ): { bet: Bet; ownerName: string } {
      const bet = Bet.fromState({
        id,
        userId: `user-${id}`,
        label: `Bet ${id}`,
        status: "closed",
        groupPredictions: null,
        knockoutWinners: {},
        createdAt: new Date(
          new Date("2026-06-08T12:00:00Z").getTime() + createdOffset * 1000,
        ),
      });
      return { bet, ownerName: `Owner ${id}` };
    }

    function makeLeaderboard(bets: { bet: Bet; ownerName: string }[]) {
      return Leaderboard.create(bets, null, window, afterDeadline, null, false);
    }

    it("should return empty arrays for an empty leaderboard", () => {
      const lb = Leaderboard.create(
        [],
        null,
        window,
        afterDeadline,
        null,
        false,
      );
      const result = lb.bestAndWorst(3);
      expect(result.best).toEqual([]);
      expect(result.worst).toEqual([]);
    });

    it("should return single list when 1 bet exists (≤2n)", () => {
      const bets = [makeBet("a")];
      const lb = makeLeaderboard(bets);
      const result = lb.bestAndWorst(3);
      expect(result.best).toHaveLength(0);
      expect(result.worst).toHaveLength(0);
      expect(result.single).toHaveLength(1);
      expect(result.single![0].betId).toBe("a");
    });

    it("should return single list when total bets ≤ 2n (no duplication)", () => {
      const bets = [makeBet("a"), makeBet("b"), makeBet("c"), makeBet("d")];
      const lb = makeLeaderboard(bets);
      const result = lb.bestAndWorst(3); // 4 bets ≤ 6
      expect(result.best).toHaveLength(0);
      expect(result.worst).toHaveLength(0);
      expect(result.single).toHaveLength(4);
    });

    it("should return single list when total bets exactly = 2n (no duplication)", () => {
      const bets = [
        makeBet("a"),
        makeBet("b"),
        makeBet("c"),
        makeBet("d"),
        makeBet("e"),
        makeBet("f"),
      ];
      const lb = makeLeaderboard(bets);
      const result = lb.bestAndWorst(3); // 6 bets = 6 = 2*3
      expect(result.single).toHaveLength(6);
    });

    it("should return disjoint top-n and bottom-n when bets > 2n", () => {
      const bets = [
        makeBet("a", 0), // will all be 0 points since no actualResult
        makeBet("b", 1),
        makeBet("c", 2),
        makeBet("d", 3),
        makeBet("e", 4),
        makeBet("f", 5),
        makeBet("g", 6),
      ];
      const lb = makeLeaderboard(bets);
      // all same points, so ranked 1..7 by createdAt order
      const result = lb.bestAndWorst(3); // 7 bets > 6
      expect(result.single).toBeUndefined();
      expect(result.best).toHaveLength(3);
      expect(result.worst).toHaveLength(3);
      // Best are first 3 (ranked 1,2,3), worst are last 3 (ranks 5,6,7)
      expect(result.best[0].betId).toBe("a");
      expect(result.best[1].betId).toBe("b");
      expect(result.best[2].betId).toBe("c");
      expect(result.worst[0].betId).toBe("e");
      expect(result.worst[1].betId).toBe("f");
      expect(result.worst[2].betId).toBe("g");
    });

    it("should not include the same entry in both best and worst", () => {
      const bets = [
        makeBet("a", 0),
        makeBet("b", 1),
        makeBet("c", 2),
        makeBet("d", 3),
        makeBet("e", 4),
        makeBet("f", 5),
        makeBet("g", 6),
      ];
      const lb = makeLeaderboard(bets);
      const result = lb.bestAndWorst(3);
      const bestIds = new Set(result.best.map((e) => e.betId));
      const worstIds = new Set(result.worst.map((e) => e.betId));
      for (const id of bestIds) {
        expect(worstIds.has(id)).toBe(false);
      }
    });

    it("should include zero-point bets as eligible worst entries", () => {
      const bets = [
        makeBet("a", 0),
        makeBet("b", 1),
        makeBet("c", 2),
        makeBet("d", 3),
        makeBet("e", 4),
        makeBet("f", 5),
        makeBet("g", 6),
      ];
      const lb = makeLeaderboard(bets);
      const result = lb.bestAndWorst(3);
      // Zero-point bets appear in worst
      for (const entry of result.worst!) {
        expect(entry.points).toBe(0);
      }
    });

    it("should take ties in existing sort order", () => {
      // All have same points (null actualResult → 0 pts), tiebreak by createdAt
      const bets = [
        makeBet("a", 0),
        makeBet("b", 1),
        makeBet("c", 2),
        makeBet("d", 3),
        makeBet("e", 4),
        makeBet("f", 5),
        makeBet("g", 6),
      ];
      const lb = makeLeaderboard(bets);
      const result = lb.bestAndWorst(3);
      // Existing sort order: a, b, c, d, e, f, g
      expect(result.best!.map((e) => e.betId)).toEqual(["a", "b", "c"]);
      expect(result.worst!.map((e) => e.betId)).toEqual(["e", "f", "g"]);
    });
  });

  describe("Label Obfuscation in Leaderboard", () => {
    const testBet = Bet.fromState({
      id: "bet-1",
      userId: "import-owner",
      label: "123 | David",
      status: "closed",
      groupPredictions: null,
      knockoutWinners: {},
    });

    it("should obfuscate labels for non-owners in imported communities", () => {
      const leaderboard = Leaderboard.create(
        [{ bet: testBet, ownerName: "David" }],
        actualResult,
        window,
        afterDeadline,
        "other-user",
        false,
        true, // imported
      );

      expect(leaderboard.entries[0].betName).toEqual({
        obfuscated: true,
        num: "123",
        head: "Da",
        tail: "id",
        middleLen: 1,
      });
      expect(leaderboard.entries[0].bet?.label).toEqual({
        obfuscated: true,
        num: "123",
        head: "Da",
        tail: "id",
        middleLen: 1,
      });
    });

    it("should show full labels for the owner in imported communities", () => {
      const leaderboard = Leaderboard.create(
        [{ bet: testBet, ownerName: "David" }],
        actualResult,
        window,
        afterDeadline,
        "import-owner",
        false,
        true, // imported
      );

      expect(leaderboard.entries[0].betName).toEqual({
        obfuscated: false,
        value: "123 | David",
      });
      expect(leaderboard.entries[0].bet?.label).toEqual({
        obfuscated: false,
        value: "123 | David",
      });
    });

    it("should show full labels for everyone in native communities", () => {
      const leaderboard = Leaderboard.create(
        [{ bet: testBet, ownerName: "David" }],
        actualResult,
        window,
        afterDeadline,
        "other-user",
        false,
        false, // not imported
      );

      expect(leaderboard.entries[0].betName).toEqual({
        obfuscated: false,
        value: "123 | David",
      });
      expect(leaderboard.entries[0].bet?.label).toEqual({
        obfuscated: false,
        value: "123 | David",
      });
    });
  });
});
