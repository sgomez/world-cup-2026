import { describe, expect, it } from "vitest";
import type { GroupOrders } from "@/lib/bracket-core";
import { LiveResult } from "@/modules/live/domain/live-result";
import {
  computeTournamentBracket,
  type DerivedResult,
  deriveResult,
  isCompetitionEndedFromLiveResults,
} from "./derive-result";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function finishedMatch(
  num: number,
  goals1: number,
  goals2: number,
  penalties1?: number,
  penalties2?: number,
): LiveResult {
  return LiveResult.fromState({
    num,
    status: "finished",
    goals1,
    goals2,
    ...(penalties1 !== undefined ? { penalties1 } : {}),
    ...(penalties2 !== undefined ? { penalties2 } : {}),
  });
}

function liveMatch(num: number, goals1: number, goals2: number): LiveResult {
  return LiveResult.fromState({ num, status: "live", goals1, goals2 });
}

// Group A match numbers: 1, 2, 25, 26, 49, 50
// Group A teams (id): mex, rsa, kor, cze
// worldcup.json match participants:
//   1: Mexico vs South Africa       (mex vs rsa)
//   2: South Korea vs Czech Republic (kor vs cze)
//  25: Czech Republic vs South Africa (cze vs rsa)
//  26: Mexico vs South Korea        (mex vs kor)
//  49: Czech Republic vs Mexico     (cze vs mex)
//  50: South Africa vs South Korea  (rsa vs kor)

// Group B match numbers: 3, 4, 27, 28, 51, 52
// Group B teams: can(Canada), bih(Bosnia&Herz), qat(Qatar), sui(Switzerland)
// worldcup.json Group B match participants:
//   3: Canada vs Bosnia & Herzegovina  (can vs bih)
//   4: Qatar vs Switzerland            (qat vs sui)
//  27: Switzerland vs Bosnia & Herz   (sui vs bih)
//  28: Canada vs Qatar                 (can vs qat)
//  51: Switzerland vs Canada           (sui vs can)
//  52: Bosnia & Herzegovina vs Qatar   (bih vs qat)

// A full set of group-A matches:
// Match structure:
//   1: Mexico vs South Africa    (mex vs rsa)
//   2: South Korea vs Czech Rep  (kor vs cze)
//  25: Czech Rep vs South Africa (cze vs rsa)
//  26: Mexico vs South Korea     (mex vs kor)
//  49: Czech Rep vs Mexico       (cze vs mex)
//  50: South Africa vs South Korea (rsa vs kor)
//
// Setup: mex wins all 3, kor 2nd, rsa 3rd, cze last
// 1: mex(1) vs rsa(0) → mex+3, rsa+0
// 2: kor(1) vs cze(0) → kor+3, cze+0
// 25: cze(0) vs rsa(1) → rsa+3, cze+0
// 26: mex(1) vs kor(0) → mex+3, kor+0
// 49: cze(0) vs mex(1) → mex+3, cze+0
// 50: rsa(0) vs kor(1) → kor+3, rsa+0
// mex=9, kor=6, rsa=3, cze=0 → order: mex, kor, rsa, cze

function allGroupAFinished(): LiveResult[] {
  return [
    finishedMatch(1, 1, 0), // mex beats rsa
    finishedMatch(2, 1, 0), // kor beats cze
    finishedMatch(25, 0, 1), // rsa beats cze
    finishedMatch(26, 1, 0), // mex beats kor
    finishedMatch(49, 0, 1), // mex beats cze (cze=team1=0, mex=team2=1)
    finishedMatch(50, 0, 1), // kor beats rsa (rsa=team1=0, kor=team2=1)
  ];
}

// Group B setup: can wins all, sui 2nd, qat 3rd, bih last
// 3: can(2) vs bih(0) → can+3
// 4: qat(0) vs sui(1) → sui+3
// 27: sui(2) vs bih(0) → sui+3
// 28: can(1) vs qat(0) → can+3
// 51: sui(0) vs can(1) → can+3
// 52: bih(0) vs qat(1) → qat+3
// can=9, sui=6, qat=3, bih=0 → order: can, sui, qat, bih
function allGroupBFinished(): LiveResult[] {
  return [
    finishedMatch(3, 2, 0), // can beats bih
    finishedMatch(4, 0, 1), // sui beats qat
    finishedMatch(27, 2, 0), // sui beats bih
    finishedMatch(28, 1, 0), // can beats qat
    finishedMatch(51, 0, 1), // can beats sui (sui=team1=0, can=team2=1)
    finishedMatch(52, 0, 1), // qat beats bih (bih=team1=0, qat=team2=1)
  ];
}

// 1A=mex, 2A=kor, 1B=can, 2B=sui
// R32-73: 2A vs 2B = kor vs sui

describe("deriveResult — group advancement", () => {
  it("returns empty groupOrders and no advancement when no LiveResults", () => {
    const result = deriveResult([], {}, null);
    // No matches → all groups unsettled
    expect(result.groupOrders).toEqual({});
    expect(result.advancement).toEqual([]);
    expect(result.knockoutWinners).toEqual({});
  });

  it("derives the correct group order from finished group-stage LiveResults", () => {
    const liveResults = allGroupAFinished();
    const result = deriveResult(liveResults, {}, null);

    // Group A is fully finished → should have a settled order
    expect(result.groupOrders.A).toBeDefined();
    expect(result.groupOrders.A).toHaveLength(4);
    // mex wins all 3 → 9pts → first
    expect(result.groupOrders.A[0]).toBe("mex");
    // kor: 6pts (beat cze+rsa) → second
    expect(result.groupOrders.A[1]).toBe("kor");
    // rsa: 3pts (beat cze) → third
    expect(result.groupOrders.A[2]).toBe("rsa");
    // cze: 0pts → last
    expect(result.groupOrders.A[3]).toBe("cze");
  });

  it("marks 1A and 2A as Advanced when group A is complete", () => {
    const liveResults = allGroupAFinished();
    const result = deriveResult(liveResults, {}, null);

    expect(result.advancement).toContain("1A");
    expect(result.advancement).toContain("2A");
    // Third slot NOT advanced until all 12 groups finish
    expect(result.advancement).not.toContain("3rd-1A");
  });

  it("does NOT advance group A when a group A match is still live", () => {
    const liveResults = [
      ...allGroupAFinished().slice(0, 5),
      liveMatch(50, 1, 0), // last group A match is live
    ];
    const result = deriveResult(liveResults, {}, null);

    expect(result.advancement).not.toContain("1A");
    expect(result.advancement).not.toContain("2A");
  });

  it("returns provisional groupOrders using live matches when finishedOnly=false", () => {
    const liveResults = [
      ...allGroupAFinished().slice(0, 5),
      liveMatch(50, 1, 0), // last group A match is live
    ];
    const result = deriveResult(liveResults, {}, null, { finishedOnly: false });

    // Provisional: group A order exists even though not fully done
    expect(result.groupOrders.A).toBeDefined();
    expect(result.groupOrders.A).toHaveLength(4);
    // Still no advancement (live never settles)
    expect(result.advancement).not.toContain("1A");
  });

  it("applies manualTieBreaks to resolve tied groups", () => {
    // Make rsa and kor tie so manual overrides matter
    // Match setup: mex wins all (9pts), rsa and kor draw (1pt each from h2h) with same GD/goals
    // match 1: mex(2) vs rsa(0)
    // match 2: kor(1) vs cze(0)
    // match 25: cze(0) vs rsa(1)
    // match 26: mex(2) vs kor(0)
    // match 49: cze(0) vs mex(1)
    // match 50: rsa(1) vs kor(1) — draw
    // mex=9, rsa=0+3+1=4, kor=3+0+1=4, cze=0
    // h2h rsa vs kor (match 50): draw → same h2h pts → same h2h GD → same h2h goals → stable
    // Manual says kor before rsa
    const liveResults = [
      finishedMatch(1, 2, 0), // mex beats rsa
      finishedMatch(2, 1, 0), // kor beats cze
      finishedMatch(25, 0, 1), // rsa beats cze (rsa scores 1 vs cze)
      finishedMatch(26, 2, 0), // mex beats kor
      finishedMatch(49, 0, 1), // mex beats cze
      finishedMatch(50, 1, 1), // rsa draws kor
    ];
    // rsa pts: 0(vs mex)+3(vs cze)+1(vs kor)=4, kor pts: 3(vs cze)+0(vs mex)+1(vs rsa)=4
    const result = deriveResult(liveResults, { A: { kor: 2, rsa: 1 } }, null);

    expect(result.groupOrders.A[0]).toBe("mex"); // 9pts
    expect(result.groupOrders.A[1]).toBe("kor"); // manual says kor before rsa (2 > 1)
    expect(result.groupOrders.A[2]).toBe("rsa");
    expect(result.groupOrders.A[3]).toBe("cze"); // 0pts
  });
});

describe("deriveResult — knockout winners", () => {
  it("derives R32-73 winner from finished LiveResult (goals decide)", () => {
    // R32-73 is match 73: 2A vs 2B
    // Group A: 1A=mex, 2A=kor (from allGroupAFinished)
    // Group B: 1B=can, 2B=sui (from allGroupBFinished)
    // R32-73: 2A(kor) vs 2B(sui), kor wins 2-0
    const groupAResults = allGroupAFinished(); // 2A = kor
    const groupBResults = allGroupBFinished(); // 2B = sui
    const r32Match73Result = finishedMatch(73, 2, 0); // kor(team1) wins 2-0

    const allResults = [...groupAResults, ...groupBResults, r32Match73Result];
    const result = deriveResult(allResults, {}, null);

    expect(result.knockoutWinners["R32-73"]).toBe("kor"); // 2A
  });

  it("uses penalty shootout to break a draw in knockout", () => {
    const groupAResults = allGroupAFinished(); // 2A = kor
    const groupBResults = allGroupBFinished(); // 2B = sui
    // R32-73: kor(2A) vs sui(2B), draw after 90min, sui wins on pens 5-4
    const r32Match73Result = LiveResult.fromState({
      num: 73,
      status: "finished",
      goals1: 1,
      goals2: 1,
      penalties1: 4,
      penalties2: 5,
    });

    const allResults = [...groupAResults, ...groupBResults, r32Match73Result];
    const result = deriveResult(allResults, {}, null);

    // sui (2B) wins on penalties (penalties2=5 > penalties1=4)
    expect(result.knockoutWinners["R32-73"]).toBe("sui");
  });

  it("does NOT record a knockout winner if the match is still live", () => {
    const groupAResults = allGroupAFinished();
    const groupBResults = allGroupBFinished();
    const r32Match73Live = liveMatch(73, 1, 0);

    const allResults = [...groupAResults, ...groupBResults, r32Match73Live];
    const result = deriveResult(allResults, {}, null);

    expect(result.knockoutWinners["R32-73"]).toBeUndefined();
  });
});

describe("deriveResult — thirdPlaceOrder", () => {
  it("returns empty thirdPlaceOrder when not all 12 groups are complete", () => {
    const result = deriveResult(allGroupAFinished(), {}, null);
    // Only group A is done, not all 12
    expect(result.thirdPlaceOrder).toEqual([]);
  });
});

describe("deriveResult — third-place R32 slots (integration)", () => {
  function allGroupsFinished(): LiveResult[] {
    // matches 1-72 cover all 12 group stages; team1 wins 1-0 everywhere
    return Array.from({ length: 72 }, (_, i) => finishedMatch(i + 1, 1, 0));
  }

  it("populates all 8 third-place R32 slots when all 12 groups complete", () => {
    const result = deriveResult(allGroupsFinished(), {}, null);

    expect(result.thirdPlaceOrder).toHaveLength(8);

    const bracket = computeTournamentBracket(result);

    // R32 matches where team2 is a third: 74, 77, 79, 80, 81, 82, 85, 87
    for (const num of [74, 77, 79, 80, 81, 82, 85, 87]) {
      expect(
        bracket[`R32-${num}`].team2Id,
        `R32-${num} team2Id`,
      ).not.toBeNull();
    }
  });
});

describe("computeTournamentBracket — third-place R32 slots", () => {
  it("populates team2Id for all 8 third-place slots when all 12 groups advance", () => {
    // top-8 thirds = e,f,g,h,i,j,k,l → combinationKey "efghijkl"
    const thirdPlaceOrder = [
      "3rd-e",
      "3rd-f",
      "3rd-g",
      "3rd-h",
      "3rd-i",
      "3rd-j",
      "3rd-k",
      "3rd-l",
      "3rd-a",
      "3rd-b",
      "3rd-c",
      "3rd-d",
    ];
    const groupOrders: GroupOrders = Object.fromEntries(
      ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"].map((g) => [
        g,
        [`t1${g}`, `t2${g}`, `t3${g}`, `t4${g}`],
      ]),
    );
    const advancement = [
      ...["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"].flatMap(
        (g) => [`1${g}`, `2${g}`],
      ),
      "3rd-1E",
      "3rd-1I",
      "3rd-1A",
      "3rd-1L",
      "3rd-1D",
      "3rd-1G",
      "3rd-1B",
      "3rd-1K",
    ];
    const derived: DerivedResult = {
      groupOrders,
      thirdPlaceOrder,
      knockoutWinners: {},
      advancement,
    };

    const bracket = computeTournamentBracket(derived);

    // All 8 third-place R32 slots must be non-null (regression: uppercase key bug caused null)
    expect(bracket["R32-74"].team2Id).not.toBeNull(); // 1E vs 3rd
    expect(bracket["R32-77"].team2Id).not.toBeNull(); // 1I vs 3rd
    expect(bracket["R32-79"].team2Id).not.toBeNull(); // 1A vs 3rd
    expect(bracket["R32-80"].team2Id).not.toBeNull(); // 1L vs 3rd
    expect(bracket["R32-81"].team2Id).not.toBeNull(); // 1D vs 3rd
    expect(bracket["R32-82"].team2Id).not.toBeNull(); // 1G vs 3rd
    expect(bracket["R32-85"].team2Id).not.toBeNull(); // 1B vs 3rd
    expect(bracket["R32-87"].team2Id).not.toBeNull(); // 1K vs 3rd
  });
});

describe("isCompetitionEndedFromLiveResults", () => {
  it("returns false when no LiveResults", () => {
    expect(isCompetitionEndedFromLiveResults([])).toBe(false);
  });

  it("returns false when only match 104 (Final) is finished", () => {
    const results = [finishedMatch(104, 1, 0)];
    expect(isCompetitionEndedFromLiveResults(results)).toBe(false);
  });

  it("returns false when only match 103 (3rd place) is finished", () => {
    const results = [finishedMatch(103, 1, 0)];
    expect(isCompetitionEndedFromLiveResults(results)).toBe(false);
  });

  it("returns true when both match 103 and 104 are finished", () => {
    const results = [finishedMatch(103, 1, 0), finishedMatch(104, 2, 1)];
    expect(isCompetitionEndedFromLiveResults(results)).toBe(true);
  });

  it("returns false when match 103 is live and 104 is finished", () => {
    const results = [liveMatch(103, 0, 0), finishedMatch(104, 1, 0)];
    expect(isCompetitionEndedFromLiveResults(results)).toBe(false);
  });
});

describe("deriveResult — provisional mode", () => {
  it("projects group top-two when group has at least one started match", () => {
    // mex vs rsa is live
    const liveResults = [liveMatch(1, 1, 0)];
    const result = deriveResult(liveResults, {}, null, { provisional: true });

    // Group A started → 1A and 2A should be in advancement
    expect(result.advancement).toContain("1A");
    expect(result.advancement).toContain("2A");
    expect(result.groupOrders.A).toBeDefined();
    expect(result.groupOrders.A).toHaveLength(4);
    // mex wins the live match → first
    expect(result.groupOrders.A[0]).toBe("mex");
  });

  it("does NOT project group top-two when group has no started matches", () => {
    // mex vs rsa is upcoming
    const liveResults = [{ num: 1, status: "upcoming", goals1: 0, goals2: 0 }];
    const result = deriveResult(liveResults as any, {}, null, {
      provisional: true,
    });

    // Group A not started → no advancement or groupOrders
    expect(result.advancement).not.toContain("1A");
    expect(result.advancement).not.toContain("2A");
    expect(result.groupOrders.A).toBeUndefined();
  });

  it("projects thirds only once all 12 groups have started", () => {
    // 1. 11 groups started (Group L is upcoming)
    const elevenStarted = [
      liveMatch(1, 1, 0), // Group A
      liveMatch(3, 1, 0), // Group B
      liveMatch(5, 1, 0), // Group C
      liveMatch(7, 1, 0), // Group D
      liveMatch(9, 1, 0), // Group E
      liveMatch(11, 1, 0), // Group F
      liveMatch(13, 1, 0), // Group G
      liveMatch(15, 1, 0), // Group H
      liveMatch(17, 1, 0), // Group I
      liveMatch(19, 1, 0), // Group J
      liveMatch(21, 1, 0), // Group K
      { num: 23, status: "upcoming", goals1: 0, goals2: 0 }, // Group L not started
    ];
    const result11 = deriveResult(elevenStarted as any, {}, null, {
      provisional: true,
    });
    expect(result11.advancement).not.toContain("3rd-1A");
    expect(result11.thirdPlaceOrder).toEqual([]);

    // 2. All 12 groups started
    const twelveStarted = [
      liveMatch(1, 1, 0), // Group A
      liveMatch(3, 1, 0), // Group B
      liveMatch(5, 1, 0), // Group C
      liveMatch(7, 1, 0), // Group D
      liveMatch(9, 1, 0), // Group E
      liveMatch(11, 1, 0), // Group F
      liveMatch(13, 1, 0), // Group G
      liveMatch(15, 1, 0), // Group H
      liveMatch(17, 1, 0), // Group I
      liveMatch(19, 1, 0), // Group J
      liveMatch(21, 1, 0), // Group K
      liveMatch(23, 1, 0), // Group L
    ];
    const result12 = deriveResult(twelveStarted, {}, null, {
      provisional: true,
    });
    expect(result12.advancement).toContain("3rd-1A");
    expect(result12.thirdPlaceOrder.length).toBe(8);
  });

  it("settles to the exact result when group finishes", () => {
    const liveResults = allGroupAFinished();
    const result = deriveResult(liveResults, {}, null, { provisional: true });

    expect(result.groupOrders.A[0]).toBe("mex");
    expect(result.groupOrders.A[1]).toBe("kor");
    expect(result.groupOrders.A[2]).toBe("rsa");
    expect(result.groupOrders.A[3]).toBe("cze");
    expect(result.advancement).toContain("1A");
    expect(result.advancement).toContain("2A");
  });

  it("has settle-on-finish parity: provisional matches result in same thirds projection as finished matches", () => {
    const finishedResults = Array.from({ length: 72 }, (_, i) =>
      finishedMatch(i + 1, 1, 0),
    );
    const settledResult = deriveResult(finishedResults, {}, null, {
      provisional: false,
    });

    const provisionalResults = Array.from({ length: 72 }, (_, i) =>
      liveMatch(i + 1, 1, 0),
    );
    const provisionalResult = deriveResult(provisionalResults, {}, null, {
      provisional: true,
    });

    expect(provisionalResult.thirdPlaceOrder).toEqual(
      settledResult.thirdPlaceOrder,
    );
    expect(provisionalResult.advancement).toEqual(settledResult.advancement);
  });

  describe("provisional mode — knockout projection", () => {
    it("projects current goals leader from a live knockout match when provisional is true", () => {
      const groupAResults = allGroupAFinished(); // 2A = kor
      const groupBResults = allGroupBFinished(); // 2B = sui
      const r32Match73Live = liveMatch(73, 2, 1); // kor (team1) is leading sui (team2) 2-1

      const results = [...groupAResults, ...groupBResults, r32Match73Live];
      const result = deriveResult(results, {}, null, { provisional: true });

      // Should project kor as winner
      expect(result.knockoutWinners["R32-73"]).toBe("kor");
    });

    it("projects no winner from a drawn live knockout match even when provisional is true", () => {
      const groupAResults = allGroupAFinished(); // 2A = kor
      const groupBResults = allGroupBFinished(); // 2B = sui
      const r32Match73Live = liveMatch(73, 1, 1); // kor draws sui 1-1

      const results = [...groupAResults, ...groupBResults, r32Match73Live];
      const result = deriveResult(results, {}, null, { provisional: true });

      // Drawn live knockout match projects no winner
      expect(result.knockoutWinners["R32-73"]).toBeUndefined();
    });

    it("settles to the exact result when a live knockout match finishes (parity)", () => {
      const groupAResults = allGroupAFinished(); // 2A = kor
      const groupBResults = allGroupBFinished(); // 2B = sui
      const r32Match73Finished = LiveResult.fromState({
        num: 73,
        status: "finished",
        goals1: 1,
        goals2: 1,
        penalties1: 3,
        penalties2: 4,
      }); // sui wins on penalties

      const results = [...groupAResults, ...groupBResults, r32Match73Finished];

      const provisionalResult = deriveResult(results, {}, null, {
        provisional: true,
      });
      const settledResult = deriveResult(results, {}, null, {
        provisional: false,
      });

      expect(provisionalResult.knockoutWinners["R32-73"]).toBe("sui");
      expect(settledResult.knockoutWinners["R32-73"]).toBe("sui");
      expect(provisionalResult.knockoutWinners).toEqual(
        settledResult.knockoutWinners,
      );
    });

    it("does NOT project winner for a live knockout match when provisional is false", () => {
      const groupAResults = allGroupAFinished(); // 2A = kor
      const groupBResults = allGroupBFinished(); // 2B = sui
      const r32Match73Live = liveMatch(73, 2, 1); // kor leads 2-1

      const results = [...groupAResults, ...groupBResults, r32Match73Live];
      const result = deriveResult(results, {}, null, { provisional: false });

      // Live knockout match is ignored in settled mode
      expect(result.knockoutWinners["R32-73"]).toBeUndefined();
    });
  });
});
