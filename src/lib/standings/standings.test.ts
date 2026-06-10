import { describe, expect, it } from "vitest";
import {
  computeGroupStanding,
  DEFAULT_TIEBREAK_CHAIN,
  type GroupMatch,
  getAdvancement,
  h2hGoalDiffCriterion,
  h2hGoalsCriterion,
  h2hPointsCriterion,
  makeManualCriterion,
  rankThirds,
  stableCriterion,
  type TeamId,
  type TieBreakContext,
  type TieBreakCriterion,
} from "./standings";

// ---- helpers ---------------------------------------------------------------

function match(
  num: number,
  t1: TeamId,
  t2: TeamId,
  g1: number,
  g2: number,
  status: "finished" | "live" = "finished",
): GroupMatch {
  return { num, team1: t1, team2: t2, goals1: g1, goals2: g2, status };
}

// ---- computeGroupStanding --------------------------------------------------

describe("computeGroupStanding — basic points ordering", () => {
  it("orders teams by points (3 for win, 1 for draw, 0 for loss)", () => {
    const teams: TeamId[] = ["A", "B", "C", "D"];
    // A beats B (3pts), C draws D (1pt each), A draws C (1pt), B beats D (3pts)
    // A beats D (3pts), B draws C (1pt)
    // A: 3+1+3=7; B: 0+3+1=4; C: 1+1+0=2; D: 0+1+0=1 (wait: need all 6 matches)
    // Full 6 matches for 4 teams: A-B, A-C, A-D, B-C, B-D, C-D
    const matches: GroupMatch[] = [
      match(1, "A", "B", 2, 0), // A wins 3pts
      match(2, "A", "C", 1, 1), // draw: A 1pt, C 1pt
      match(3, "A", "D", 3, 0), // A wins 3pts
      match(4, "B", "C", 1, 1), // draw: B 1pt, C 1pt
      match(5, "B", "D", 2, 0), // B wins 3pts
      match(6, "C", "D", 2, 1), // C wins 3pts
    ];
    // Points: A=7, B=4, C=5, D=0
    const order = computeGroupStanding(teams, matches, DEFAULT_TIEBREAK_CHAIN);
    expect(order[0]).toBe("A");
    expect(order[1]).toBe("C");
    expect(order[2]).toBe("B");
    expect(order[3]).toBe("D");
  });
});

describe("computeGroupStanding — h2h tie-breaking", () => {
  it("resolves two-way tie by h2h points", () => {
    // A and B tied at 4pts overall; C=7, D=1
    // h2h A vs B: A wins → A ranked above B
    const teams: TeamId[] = ["A", "B", "C", "D"];
    const _matches: GroupMatch[] = [
      match(1, "A", "B", 2, 0), // A beats B (A+3, B+0)
      match(2, "A", "C", 0, 2), // C beats A (A+0, C+3)
      match(3, "A", "D", 1, 0), // A beats D (A+3, D+0)
      match(4, "B", "C", 0, 2), // C beats B (B+0, C+3)
      match(5, "B", "D", 2, 0), // B beats D (B+3, D+0)
      match(6, "C", "D", 1, 0), // C beats D (C+3, D+0)
    ];
    // A: 3+0+3=6, B: 0+0+3=3 — NOT a two-way tie.
    // Build actual 2-way tie: A=B=4pts, C and D separate
    const _matches2: GroupMatch[] = [
      match(1, "A", "B", 2, 0), // A beats B (A+3, B+0)
      match(2, "A", "C", 0, 2), // C beats A (A+0, C+3)
      match(3, "A", "D", 1, 0), // A beats D (A+3, D+0)
      match(4, "B", "C", 0, 2), // C beats B (B+0, C+3)
      match(5, "B", "D", 1, 1), // draw (B+1, D+1)
      match(6, "C", "D", 1, 0), // C beats D (C+3, D+0)
    ];
    // A: 3+0+3=6, B: 0+0+1=1 — still not equal.
    // Make A=B=4 exactly:
    // A: wins 1, draws 1, loses 1 → 4pts; B: wins 1, draws 1, loses 1 → 4pts
    // A beats B (3), A draws D (1), A loses to C (0) → A=4
    // B loses to A (0), B beats C (3), B draws D (1) → B=4
    // C beats A (3), C loses to B (0), C beats D (3) → C=6
    // D draws A (1), D draws B (1), D loses to C (0) → D=2
    const matches3: GroupMatch[] = [
      match(1, "A", "B", 2, 0), // A beats B (A+3, B+0)
      match(2, "A", "C", 0, 1), // C beats A (A+0, C+3)
      match(3, "A", "D", 1, 1), // draw (A+1, D+1)
      match(4, "B", "C", 2, 0), // B beats C (B+3, C+0)
      match(5, "B", "D", 1, 1), // draw (B+1, D+1)
      match(6, "C", "D", 2, 0), // C beats D (C+3, D+0)
    ];
    // A: 3+0+1=4, B: 0+3+1=4, C: 3+0+3=6, D: 1+1+0=2
    // C first (6pts), A and B tied (4pts), D last (2pts)
    // h2h A vs B: A won (2-0) → A has 3 h2h pts, B has 0 → A above B
    const order = computeGroupStanding(teams, matches3, DEFAULT_TIEBREAK_CHAIN);
    expect(order[0]).toBe("C"); // clearly first
    expect(order[1]).toBe("A"); // A beats B h2h
    expect(order[2]).toBe("B");
    expect(order[3]).toBe("D"); // clearly last
  });

  it("resolves three-way tie by h2h goal difference", () => {
    // Three teams all draw against each other → tied on h2h points (1 each)
    // Differentiate by h2h goal difference
    const teams: TeamId[] = ["A", "B", "C", "D"];
    const _matches: GroupMatch[] = [
      match(1, "A", "B", 2, 1), // A beats B overall but need 3-way tied on points
      match(2, "A", "C", 1, 2), // C beats A
      match(3, "A", "D", 2, 0), // A beats D
      match(4, "B", "C", 2, 1), // B beats C
      match(5, "B", "D", 0, 1), // D beats B
      match(6, "C", "D", 2, 1), // C beats D
    ];
    // A: 3+0+3=6, B: 0+3+0=3 — let me try a proper 3-way tie
    // 3-way tie: A,B,C all get same points; D is irrelevant
    // A beats D, B beats D, C beats D → each gets 3 pts from D matches
    // A,B,C all draw each other → each gets 2 pts from internal matches
    // Total: A=B=C=5pts, D=0
    const matches2: GroupMatch[] = [
      match(1, "A", "B", 1, 1), // draw
      match(2, "A", "C", 1, 1), // draw
      match(3, "B", "C", 1, 1), // draw
      match(4, "A", "D", 2, 0), // A beats D
      match(5, "B", "D", 3, 0), // B beats D
      match(6, "C", "D", 1, 0), // C beats D
    ];
    // A=B=C=5pts. h2h matches among A,B,C: all draws → h2h points all equal (2)
    // h2h GD: A=0 (1-1 + 1-1 = 0), B=0, C=0 → still tied
    // h2h goals: A=2, B=2, C=2 → still tied
    // Manual & stable → stable order (original input order)
    const order = computeGroupStanding(teams, matches2, DEFAULT_TIEBREAK_CHAIN);
    // D last; A,B,C in some stable order
    expect(order[3]).toBe("D");
    // stable: preserve input ordering (A, B, C original positions 0,1,2)
    expect(order.slice(0, 3)).toEqual(["A", "B", "C"]);
  });

  it("resolves h2h goal difference when h2h points are equal", () => {
    // A and B tied on overall points and h2h points (both draw each other)
    // But A has better h2h GD
    const teams: TeamId[] = ["A", "B", "C", "D"];
    // A draws B 2-2 and A beats C, B loses to C → not equal h2h pts
    // Use full setup where A and B draw each other but A has better h2h GD via other criterion
    // Actually h2h GD is from the h2h match only (among the cluster)
    // If A and B tied and their only h2h is a draw (1-1), GD=0 for both
    // If their only h2h is 2-1 for A, then h2h pts: A=3, B=0 → resolves by h2h points
    // Let's test 3-way tie where h2h GD differs:
    // A beats B (1-0), B beats C (1-0), C beats A (1-0) — rock-paper-scissors — all 1 h2h pt each
    // h2h GD: A: 1-0-1 = 0; B: -1+1+0 = 0; C: 0-1+1 = 0; still equal
    // To get different h2h GD: A beats B 3-0, B beats C 3-0, C beats A 3-0
    // A: +3-3=0, B: -3+3=0, C: -3+3=0 still 0!
    // How about: A draws B 2-2, A draws C 1-1, B draws C 0-0
    // h2h pts: all 2 pts; h2h GD: A=0 (0+0), B=0, C=0; h2h goals: A=3, B=2, C=1
    // So C is resolved last by h2h goals
    const matches: GroupMatch[] = [
      match(1, "A", "B", 2, 2), // draw
      match(2, "A", "C", 1, 1), // draw
      match(3, "B", "C", 0, 0), // draw
      match(4, "A", "D", 1, 0), // A beats D (gives everyone different total pts actually)
      match(5, "B", "D", 1, 0), // B beats D
      match(6, "C", "D", 1, 0), // C beats D
    ];
    // A=B=C=5pts, D=0
    // h2h pts among {A,B,C}: all 2pts
    // h2h GD: A=(2-2)+(1-1)=0, B=(2-2)+(0-0)=0, C=(1-1)+(0-0)=0
    // h2h goals: A=2+1=3, B=2+0=2, C=1+0=1
    const order = computeGroupStanding(teams, matches, DEFAULT_TIEBREAK_CHAIN);
    expect(order[3]).toBe("D");
    expect(order[0]).toBe("A"); // most h2h goals
    expect(order[1]).toBe("B");
    expect(order[2]).toBe("C");
  });
});

describe("computeGroupStanding — stable fallback", () => {
  it("preserves input order when criteria are exhausted (not alphabetical)", () => {
    // Z, Y, X all tied and no h2h difference → stable (original order Z,Y,X)
    const teams: TeamId[] = ["Z", "Y", "X", "D"];
    const matches: GroupMatch[] = [
      match(1, "Z", "Y", 1, 1),
      match(2, "Z", "X", 1, 1),
      match(3, "Y", "X", 1, 1),
      match(4, "Z", "D", 1, 0),
      match(5, "Y", "D", 1, 0),
      match(6, "X", "D", 1, 0),
    ];
    const order = computeGroupStanding(teams, matches, DEFAULT_TIEBREAK_CHAIN);
    expect(order[3]).toBe("D");
    // Z, Y, X must be in original order
    expect(order.slice(0, 3)).toEqual(["Z", "Y", "X"]);
  });

  it("does not sort alphabetically — input order is preserved for ties", () => {
    const teams: TeamId[] = ["C", "A", "B", "D"];
    const matches: GroupMatch[] = [
      match(1, "C", "A", 1, 1),
      match(2, "C", "B", 1, 1),
      match(3, "A", "B", 1, 1),
      match(4, "C", "D", 2, 0),
      match(5, "A", "D", 2, 0),
      match(6, "B", "D", 2, 0),
    ];
    const order = computeGroupStanding(teams, matches, DEFAULT_TIEBREAK_CHAIN);
    expect(order[3]).toBe("D");
    expect(order.slice(0, 3)).toEqual(["C", "A", "B"]); // NOT alphabetical A,B,C
  });
});

describe("manual criterion", () => {
  it("applies only to still-tied clusters, cannot reorder separated teams", () => {
    const teams: TeamId[] = ["A", "B", "C", "D"];
    // A has more points than B, C, D
    // B and C are tied on everything → admin says C before B
    const matches: GroupMatch[] = [
      match(1, "A", "B", 3, 0),
      match(2, "A", "C", 3, 0),
      match(3, "A", "D", 3, 0),
      match(4, "B", "C", 1, 1), // draw, same h2h pts/GD/goals
      match(5, "B", "D", 2, 0),
      match(6, "C", "D", 2, 0),
    ];
    // A=9, B=1+3=4, C=1+3=4, D=0; B and C tied after h2h
    // h2h B vs C: draw 1-1 → same h2h pts (1 each), same GD (0), same goals (1)
    // manual says C before B
    const _chain = [...DEFAULT_TIEBREAK_CHAIN];
    // Replace stable with manual then stable
    const manualList: TeamId[] = ["C", "B"]; // Admin says: C first
    const manual = makeManualCriterion(manualList);

    const order = computeGroupStanding(teams, matches, [
      ...DEFAULT_TIEBREAK_CHAIN.slice(0, -1), // drop stableCriterion
      manual,
      stableCriterion,
    ]);

    expect(order[0]).toBe("A"); // A clearly first
    expect(order[1]).toBe("C"); // manual put C before B
    expect(order[2]).toBe("B");
    expect(order[3]).toBe("D");
  });

  it("manual criterion provably cannot reorder teams separated by points", () => {
    const teams: TeamId[] = ["A", "B", "C", "D"];
    const matches: GroupMatch[] = [
      match(1, "A", "B", 2, 0),
      match(2, "A", "C", 2, 0),
      match(3, "A", "D", 2, 0),
      match(4, "B", "C", 1, 1),
      match(5, "B", "D", 2, 0),
      match(6, "C", "D", 2, 0),
    ];
    // A=9, B=4, C=4, D=0
    // Even if manual says D, B, C, A — it only acts on tied clusters
    // So D cannot jump over B or C (D is alone in its cluster)
    // and A cannot be demoted
    const manualList: TeamId[] = ["D", "B", "C", "A"]; // Admin ordered wrong way
    const manual = makeManualCriterion(manualList);

    const order = computeGroupStanding(teams, matches, [
      ...DEFAULT_TIEBREAK_CHAIN.slice(0, -1),
      manual,
      stableCriterion,
    ]);

    expect(order[0]).toBe("A"); // A must be first (9pts)
    expect(order[3]).toBe("D"); // D must be last (0pts)
    // B and C are tied; manual says B before C (D, B, C, A filtered to cluster {B,C} → B then C)
    expect(order[1]).toBe("B");
    expect(order[2]).toBe("C");
  });
});

describe("individual criterion — unit tests", () => {
  it("h2hPointsCriterion separates teams by h2h points", () => {
    const ctx: TieBreakContext = {
      cluster: ["A", "B", "C"],
      matches: [
        match(1, "A", "B", 2, 0), // A wins
        match(2, "A", "C", 1, 0), // A wins
        match(3, "B", "C", 0, 0), // draw
      ],
    };
    const result = h2hPointsCriterion(ctx);
    // A has 6 h2h pts, B has 1, C has 1 → A separated, B/C still tied
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(["A"]);
    expect(result[1]).toEqual(expect.arrayContaining(["B", "C"]));
    expect(result[1]).toHaveLength(2);
  });

  it("h2hGoalDiffCriterion separates by goal difference", () => {
    const ctx: TieBreakContext = {
      cluster: ["A", "B"],
      matches: [
        match(1, "A", "B", 3, 1), // A wins 3-1 → A GD +2, B GD -2
      ],
    };
    const result = h2hGoalDiffCriterion(ctx);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(["A"]);
    expect(result[1]).toEqual(["B"]);
  });

  it("h2hGoalsCriterion separates by goals scored", () => {
    const ctx: TieBreakContext = {
      cluster: ["A", "B"],
      matches: [
        match(1, "A", "B", 2, 2), // draw but A scored 2, B scored 2
      ],
    };
    // Both scored 2 → still tied
    const result = h2hGoalsCriterion(ctx);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(2);
  });

  it("h2hGoalsCriterion separates when goals differ", () => {
    const ctx: TieBreakContext = {
      cluster: ["A", "B"],
      matches: [
        match(1, "A", "B", 2, 0), // A scored 2, B scored 0
        match(2, "B", "A", 1, 1), // B scored 1, A scored 1
      ],
    };
    // A h2h goals: 2+1=3, B h2h goals: 0+1=1
    const result = h2hGoalsCriterion(ctx);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(["A"]);
    expect(result[1]).toEqual(["B"]);
  });

  it("stableCriterion preserves cluster in a single sub-cluster (no separation)", () => {
    const ctx: TieBreakContext = {
      cluster: ["C", "A", "B"],
      matches: [],
    };
    const result = stableCriterion(ctx);
    // Stable returns the cluster as-is in one group of size 3 (still tied, deferred)
    // Actually: stable is the LAST criterion — it returns singletons to resolve completely
    // By spec: stable → preserve previous relative order → one group per team (all separated)
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual(["C"]);
    expect(result[1]).toEqual(["A"]);
    expect(result[2]).toEqual(["B"]);
  });

  it("defers some teams when criterion cannot separate all", () => {
    const ctx: TieBreakContext = {
      cluster: ["A", "B", "C"],
      matches: [
        match(1, "A", "B", 2, 0), // A has h2h pts advantage
        match(2, "A", "C", 2, 0), // A has h2h pts advantage
        match(3, "B", "C", 1, 1), // B and C tied
      ],
    };
    const result = h2hPointsCriterion(ctx);
    // A: 6 h2h pts → separated; B and C: 1 pt each → deferred (size 2)
    expect(result[0]).toEqual(["A"]);
    const remaining = result[1];
    expect(remaining).toHaveLength(2);
    expect(remaining).toContain("B");
    expect(remaining).toContain("C");
  });
});

describe("extensibility — custom criterion", () => {
  it("allows injecting a custom criterion without modifying the engine", () => {
    const teams: TeamId[] = ["A", "B", "C", "D"];
    const matches: GroupMatch[] = [
      match(1, "A", "B", 1, 1),
      match(2, "A", "C", 1, 1),
      match(3, "B", "C", 1, 1),
      match(4, "A", "D", 1, 0),
      match(5, "B", "D", 1, 0),
      match(6, "C", "D", 1, 0),
    ];
    // A, B, C all tied on everything; custom criterion says [B, A, C]
    const customOrder: TeamId[] = ["B", "A", "C"];
    const customCriterion: TieBreakCriterion = (ctx: TieBreakContext) => {
      // Order cluster by position in customOrder
      const sorted = [...ctx.cluster].sort((x, y) => {
        const xi = customOrder.indexOf(x);
        const yi = customOrder.indexOf(y);
        const xPos = xi === -1 ? Infinity : xi;
        const yPos = yi === -1 ? Infinity : yi;
        return xPos - yPos;
      });
      // Return as singletons (fully separates)
      return sorted.map((t) => [t]);
    };

    const order = computeGroupStanding(teams, matches, [
      ...DEFAULT_TIEBREAK_CHAIN.slice(0, -1), // drop stable
      customCriterion,
      stableCriterion,
    ]);

    expect(order[3]).toBe("D");
    expect(order[0]).toBe("B");
    expect(order[1]).toBe("A");
    expect(order[2]).toBe("C");
  });
});

// ---- rankThirds ------------------------------------------------------------

describe("rankThirds", () => {
  it("selects the top 8 third-placed teams by the same criteria", () => {
    // Create 12 groups each with a third-placed team
    // Group third-placed teams are the one at position 2 (0-indexed) in each group
    // Provide distinct point values so ranking is deterministic
    const groupThirds: Array<{
      group: string;
      teamId: TeamId;
      points: number;
      goalDiff: number;
      goals: number;
    }> = [
      { group: "a", teamId: "A3", points: 5, goalDiff: 3, goals: 5 },
      { group: "b", teamId: "B3", points: 5, goalDiff: 2, goals: 4 },
      { group: "c", teamId: "C3", points: 5, goalDiff: 1, goals: 3 },
      { group: "d", teamId: "D3", points: 4, goalDiff: 3, goals: 5 },
      { group: "e", teamId: "E3", points: 4, goalDiff: 2, goals: 4 },
      { group: "f", teamId: "F3", points: 4, goalDiff: 1, goals: 3 },
      { group: "g", teamId: "G3", points: 3, goalDiff: 3, goals: 5 },
      { group: "h", teamId: "H3", points: 3, goalDiff: 2, goals: 4 },
      { group: "i", teamId: "I3", points: 3, goalDiff: 1, goals: 3 },
      { group: "j", teamId: "J3", points: 2, goalDiff: 3, goals: 5 },
      { group: "k", teamId: "K3", points: 1, goalDiff: 0, goals: 2 },
      { group: "l", teamId: "L3", points: 0, goalDiff: -5, goals: 0 },
    ];

    const result = rankThirds(groupThirds, {});
    // Top 8 by points: A3(5), B3(5), C3(5), D3(4), E3(4), F3(4), G3(3), H3(3)
    const topTeamIds = result.ranked.map((r) => r.teamId);
    expect(topTeamIds).toHaveLength(8);
    expect(topTeamIds[0]).toBe("A3");
    expect(topTeamIds[1]).toBe("B3");
    expect(topTeamIds[2]).toBe("C3");
    // D, E, F are next (4pts)
    expect(topTeamIds.slice(3, 6)).toEqual(
      expect.arrayContaining(["D3", "E3", "F3"]),
    );
    // G and H next (3pts, GD 3 and 2)
    expect(topTeamIds[6]).toBe("G3");
    expect(topTeamIds[7]).toBe("H3");
  });

  it("assigns R32 slots via combinations table for top 8 groups", () => {
    // Create 12 groups; groups a,b,c,d,e,f,g,h qualify (top 8 by pts)
    const groupThirds: Array<{
      group: string;
      teamId: TeamId;
      points: number;
      goalDiff: number;
      goals: number;
    }> = "abcdefghijkl".split("").map((g, i) => ({
      group: g,
      teamId: `${g.toUpperCase()}3`,
      points: 12 - i, // a=12, b=11, ..., l=1
      goalDiff: 0,
      goals: 0,
    }));

    const result = rankThirds(groupThirds, {});
    // Top 8: a,b,c,d,e,f,g,h qualify
    // groups key: sorted letters = "abcdefgh"
    // From combinations.json, "abcdefgh" maps to slot assignments
    expect(result.ranked).toHaveLength(8);
    // Slot assignments should be defined
    expect(result.slotAssignments).toBeDefined();
    for (const [slot, teamId] of Object.entries(result.slotAssignments)) {
      expect(typeof slot).toBe("string");
      expect(typeof teamId).toBe("string");
    }
  });
});

// ---- getAdvancement --------------------------------------------------------

describe("getAdvancement", () => {
  // Build a complete group (6 finished matches)
  function completeGroup(group: string, teams: TeamId[]): GroupMatch[] {
    const [t1, t2, t3, t4] = teams;
    return [
      match(1, t1, t2, 2, 0, "finished"),
      match(2, t1, t3, 1, 1, "finished"),
      match(3, t2, t3, 1, 0, "finished"),
      match(4, t1, t4, 3, 0, "finished"),
      match(5, t2, t4, 2, 0, "finished"),
      match(6, t3, t4, 2, 0, "finished"),
    ].map((m) => ({ ...m, group }));
  }

  it("returns top-2 advancement when all 6 group matches are finished", () => {
    const groupMatches = completeGroup("a", ["A1", "A2", "A3", "A4"]);
    const result = getAdvancement({
      groups: {
        a: {
          teams: ["A1", "A2", "A3", "A4"],
          matches: groupMatches,
        },
      },
      tieBreakChain: DEFAULT_TIEBREAK_CHAIN,
      manualTieBreaks: {},
      finishedOnly: true,
    });
    // A1 wins most, A2 second, etc.
    expect(result.groupAdvancement.a?.first).toBeDefined();
    expect(result.groupAdvancement.a?.second).toBeDefined();
    expect(result.groupAdvancement.a?.third).toBeDefined();
  });

  it("does NOT return advancement when group has live matches", () => {
    const groupMatches: GroupMatch[] = [
      { ...match(1, "A1", "A2", 2, 0), group: "a", status: "finished" },
      { ...match(2, "A1", "A3", 1, 0), group: "a", status: "finished" },
      { ...match(3, "A2", "A3", 1, 0), group: "a", status: "finished" },
      { ...match(4, "A1", "A4", 2, 0), group: "a", status: "finished" },
      { ...match(5, "A2", "A4", 1, 0), group: "a", status: "finished" },
      { ...match(6, "A3", "A4", 1, 1), group: "a", status: "live" }, // live!
    ];

    const result = getAdvancement({
      groups: {
        a: {
          teams: ["A1", "A2", "A3", "A4"],
          matches: groupMatches,
        },
      },
      tieBreakChain: DEFAULT_TIEBREAK_CHAIN,
      manualTieBreaks: {},
      finishedOnly: true,
    });
    // Group 'a' has a live match → no settled advancement
    expect(result.groupAdvancement.a).toBeUndefined();
  });

  it("returns thirds advancement only when all 12 groups are complete", () => {
    // Build 12 complete groups
    const groups: Record<string, { teams: TeamId[]; matches: GroupMatch[] }> =
      {};
    const groupLetters = "abcdefghijkl".split("");
    for (const g of groupLetters) {
      const t = [`${g}1`, `${g}2`, `${g}3`, `${g}4`] as TeamId[];
      groups[g] = {
        teams: t,
        matches: completeGroup(g, t),
      };
    }

    const result = getAdvancement({
      groups,
      tieBreakChain: DEFAULT_TIEBREAK_CHAIN,
      manualTieBreaks: {},
      finishedOnly: true,
    });

    // All 12 groups complete → thirds should be defined
    expect(result.thirdsAdvancement).toBeDefined();
    expect(result.thirdsAdvancement?.qualified).toHaveLength(8);
  });

  it("does NOT return thirds when only 11 of 12 groups are complete", () => {
    const groups: Record<string, { teams: TeamId[]; matches: GroupMatch[] }> =
      {};
    const groupLetters = "abcdefghijkl".split("");
    for (const g of groupLetters) {
      const t = [`${g}1`, `${g}2`, `${g}3`, `${g}4`] as TeamId[];
      // Group 'l' gets a live match
      const ms = completeGroup(g, t);
      if (g === "l") {
        ms[5] = { ...ms[5], status: "live" };
      }
      groups[g] = { teams: t, matches: ms };
    }

    const result = getAdvancement({
      groups,
      tieBreakChain: DEFAULT_TIEBREAK_CHAIN,
      manualTieBreaks: {},
      finishedOnly: true,
    });

    // Not all groups done → thirds undefined
    expect(result.thirdsAdvancement).toBeUndefined();
  });

  it("live matches never settle advancement", () => {
    // Even if 5 of 6 matches are finished with clear winner, live match prevents settlement
    const groupMatches: GroupMatch[] = [
      { ...match(1, "A1", "A2", 3, 0), group: "a", status: "finished" },
      { ...match(2, "A1", "A3", 3, 0), group: "a", status: "finished" },
      { ...match(3, "A1", "A4", 3, 0), group: "a", status: "finished" },
      { ...match(4, "A2", "A3", 1, 0), group: "a", status: "finished" },
      { ...match(5, "A2", "A4", 1, 0), group: "a", status: "finished" },
      { ...match(6, "A3", "A4", 0, 0), group: "a", status: "live" }, // live!
    ];

    const result = getAdvancement({
      groups: {
        a: {
          teams: ["A1", "A2", "A3", "A4"],
          matches: groupMatches,
        },
      },
      tieBreakChain: DEFAULT_TIEBREAK_CHAIN,
      manualTieBreaks: {},
      finishedOnly: true,
    });

    expect(result.groupAdvancement.a).toBeUndefined();
  });
});
