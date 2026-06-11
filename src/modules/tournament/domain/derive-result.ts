/**
 * derive-result.ts
 *
 * Pure functions for deriving the tournament Result read model from LiveResults.
 * No IO, no side effects. Implements ADR 0015.
 *
 * Input:  all LiveResults + sparse manual tie-break map
 * Output: groupOrders, thirdPlaceOrder, knockoutWinners, advancement
 *
 * Rules:
 * - Group orders use finished + live results for display (finishedOnly=true for advancement)
 * - Advancement: group top-2 settle when all 6 matches are finished; thirds settle when
 *   all 12 groups are finished
 * - Knockout winners: derived from finished knockout scorelines (penalties break draws)
 * - Competition End: matches 103 and 104 are both finished
 */

import {
  applyWinnerToMatches,
  createEmptyKnockoutMatches,
  type GroupOrders,
  getTeamIdFromPosition,
  type KnockoutMatch,
  type KnockoutRound,
  R32_MATCHUPS,
  ROUND_ORDER,
  type ThirdPlaceOrder,
} from "@/lib/bracket-core";
import { getAllMatches } from "@/lib/matches";
import {
  computeGroupStanding,
  DEFAULT_TIEBREAK_CHAIN,
  detectGroupTies,
  detectThirdsTies,
  type GroupMatch,
  getAdvancement,
  makeManualCriterion,
  rankThirds,
  stableCriterion,
  type TeamId,
  type ThirdPlaceEntry,
} from "@/lib/standings/standings";
import { getGroups } from "@/lib/teams";
import type { LiveResult } from "@/modules/live/domain/live-result";
import combinationsData from "../../../../data/worldcup.combinations.json";
import rawTeamsEn from "../../../../data/worldcup.teams.en.json";

export type DerivedResult = {
  /** Settled group finishing orders, keyed by uppercase group letter. Empty if not settled. */
  groupOrders: GroupOrders;
  /**
   * The ordered list of all 12 third-placed group references (e.g. "3rd-a") once
   * all groups are complete. Empty array until all 12 groups have finished.
   */
  thirdPlaceOrder: ThirdPlaceOrder;
  /** Winners of knockout matches, keyed by bracket match ID (e.g. "R32-73", "F"). */
  knockoutWinners: Record<string, string>;
  /** Which R32 slot references are Advanced (e.g. "1A", "2A", "3rd-1A"). */
  advancement: string[];
};

export type DeriveOptions = {
  /**
   * When true (default), group orders only use finished matches for advancement.
   * When false, provisional standings include live matches for display purposes.
   */
  finishedOnly?: boolean;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type RawTeam = {
  name: string;
  name_normalised?: string;
  fifa_code: string;
};

/**
 * Builds a lookup from team name (as stored in worldcup.json English names)
 * to team ID (lowercase FIFA code).
 *
 * worldcup.json uses original names (e.g. "South Korea"), while the teams data
 * may have normalised names (e.g. "Korea Republic"). Both are indexed so the
 * lookup works regardless of which form worldcup.json uses.
 */
function buildNameToIdMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const t of rawTeamsEn as RawTeam[]) {
    const id = t.fifa_code.toLowerCase();
    map.set(t.name, id);
    if (t.name_normalised) {
      map.set(t.name_normalised, id);
    }
  }
  return map;
}

/**
 * Resolves the winner of a knockout match from a finished LiveResult and both
 * participant team IDs.
 *
 * - Goals decide if different.
 * - Penalties decide a draw.
 * - Returns null if undecidable.
 */
function resolveKnockoutWinner(
  liveResult: LiveResult,
  team1Id: string,
  team2Id: string,
): string | null {
  if (liveResult.goals1 > liveResult.goals2) return team1Id;
  if (liveResult.goals2 > liveResult.goals1) return team2Id;
  // Draw — use penalties
  if (
    liveResult.penalties1 !== undefined &&
    liveResult.penalties2 !== undefined
  ) {
    if (liveResult.penalties1 > liveResult.penalties2) return team1Id;
    if (liveResult.penalties2 > liveResult.penalties1) return team2Id;
  }
  return null;
}

/**
 * Builds R32 knockout matches from groupOrders + thirdPlaceOrder + advancement.
 * Only populates team IDs for slots listed in `advancement`.
 * Mirrors computeR32MatchesForTournament in tournament.ts without the circular dep.
 */
function buildR32Matches(
  groupOrders: GroupOrders,
  thirdPlaceOrder: ThirdPlaceOrder,
  advancement: string[],
): Record<string, KnockoutMatch> {
  const combinations = combinationsData as Record<
    string,
    Record<string, string>
  >;

  const top8Letters = thirdPlaceOrder
    .slice(0, 8)
    .map((id) => id.replace("3rd-", "").toUpperCase());
  const combinationKey = [...top8Letters].sort().join("");
  const combinationMap = combinations[combinationKey] ?? {};

  const matches: Record<string, KnockoutMatch> = {};
  for (const { num, team1, team2 } of R32_MATCHUPS) {
    const matchId = `R32-${num}`;

    const isTeam1Advanced = advancement.includes(team1);
    const team1Id = isTeam1Advanced
      ? getTeamIdFromPosition(team1, groupOrders)
      : null;

    let team2Id: string | null = null;
    if (team2 === null) {
      const thirdRef = `3rd-${team1}`;
      const isTeam2Advanced = advancement.includes(thirdRef);
      if (isTeam2Advanced) {
        const lookupKey = `${team1[0]}${team1.slice(1).toLowerCase()}`;
        const thirdSlot = combinationMap[lookupKey];
        if (thirdSlot) {
          const groupLetter = thirdSlot[1].toUpperCase();
          team2Id = groupOrders[groupLetter]?.[2] ?? null;
        }
      }
    } else {
      const isTeam2Advanced = advancement.includes(team2);
      team2Id = isTeam2Advanced
        ? getTeamIdFromPosition(team2, groupOrders)
        : null;
    }

    matches[matchId] = {
      id: matchId,
      round: "R32",
      team1Id,
      team2Id,
      winnerId: null,
      loserId: null,
    };
  }
  return matches;
}

/**
 * Builds a map from bracket matchId (e.g. "R32-73") to the match number in
 * worldcup.json (e.g. 73) for all knockout matches.
 */
function buildMatchIdToNumMap(): Map<string, number> {
  const map = new Map<string, number>();
  for (const { num } of R32_MATCHUPS) {
    map.set(`R32-${num}`, num);
  }
  for (let n = 89; n <= 96; n++) map.set(`R16-${n}`, n);
  for (let n = 97; n <= 100; n++) map.set(`QF-${n}`, n);
  map.set("SF-101", 101);
  map.set("SF-102", 102);
  // 3RD=103, F=104 handled separately
  return map;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Derives the full tournament Result read model from a set of LiveResults plus
 * the sparse manual tie-break overrides.
 *
 * @param liveResults  All current LiveResults (any status).
 * @param manualTieBreaks  Per-group ordered team ID lists for Admin-resolved ties.
 *                         Key is uppercase group letter (e.g. "A").
 * @param thirdPlaceManualOrder  Admin-supplied order for the thirds cluster.
 *                               Pass null if none.
 * @param options  Derivation options (finishedOnly defaults to true).
 */
export function deriveResult(
  liveResults: LiveResult[],
  manualTieBreaks: Record<string, TeamId[]>,
  thirdPlaceManualOrder: TeamId[] | null,
  options: DeriveOptions = {},
): DerivedResult {
  const { finishedOnly = true } = options;

  const nameToId = buildNameToIdMap();
  const allMatches = getAllMatches();
  const liveByNum = new Map<number, LiveResult>(
    liveResults.map((lr) => [lr.num, lr]),
  );

  // Build per-group data structures for the standings engine
  const groupsData = getGroups("en");
  const groups: Record<string, { teams: TeamId[]; matches: GroupMatch[] }> = {};

  for (const groupData of groupsData) {
    const groupLetter = groupData.group; // "A", "B", …
    const groupName = `Group ${groupLetter}`;
    const teamIds = groupData.teams.map((t) => t.id);

    const groupMatches: GroupMatch[] = [];
    for (const m of allMatches) {
      if (m.group !== groupName) continue;
      const lr = liveByNum.get(m.num);
      if (!lr) continue; // not started

      const team1Id = nameToId.get(m.team1);
      const team2Id = nameToId.get(m.team2);
      if (!team1Id || !team2Id) continue;

      groupMatches.push({
        num: m.num,
        team1: team1Id,
        team2: team2Id,
        goals1: lr.goals1,
        goals2: lr.goals2,
        status: lr.status,
        group: groupLetter,
      });
    }

    groups[groupLetter] = { teams: teamIds, matches: groupMatches };
  }

  // Build full manual tie-breaks map including thirds
  const fullManualTieBreaks: Record<string, TeamId[]> = { ...manualTieBreaks };
  if (thirdPlaceManualOrder) {
    fullManualTieBreaks.thirds = thirdPlaceManualOrder;
  }

  // -------------------------------------------------------------------------
  // Derive advancement (always finished-only)
  // -------------------------------------------------------------------------
  const advancementResult = getAdvancement({
    groups,
    tieBreakChain: DEFAULT_TIEBREAK_CHAIN,
    manualTieBreaks: fullManualTieBreaks,
    finishedOnly: true,
  });

  // -------------------------------------------------------------------------
  // Build group orders (for display: optionally includes live matches)
  // -------------------------------------------------------------------------
  const displayAdvancementResult = finishedOnly
    ? advancementResult
    : getAdvancement({
        groups,
        tieBreakChain: DEFAULT_TIEBREAK_CHAIN,
        manualTieBreaks: fullManualTieBreaks,
        finishedOnly: false,
      });

  const groupOrders: GroupOrders = {};
  for (const [groupLetter, adv] of Object.entries(
    displayAdvancementResult.groupAdvancement,
  )) {
    if (!adv) continue;
    const { teams, matches } = groups[groupLetter] ?? {
      teams: [],
      matches: [],
    };
    if (teams.length === 0) continue;

    const manualList = fullManualTieBreaks[groupLetter];
    const chain = manualList
      ? [
          ...DEFAULT_TIEBREAK_CHAIN.slice(0, -1),
          makeManualCriterion(manualList),
          stableCriterion,
        ]
      : DEFAULT_TIEBREAK_CHAIN;

    groupOrders[groupLetter] = computeGroupStanding(teams, matches, chain);
  }

  // -------------------------------------------------------------------------
  // Build finishedGroupOrders (used for knockout bracket derivation)
  // -------------------------------------------------------------------------
  const finishedGroupOrders: GroupOrders = {};
  const thirdEntries: ThirdPlaceEntry[] = [];
  const advancementRefs: string[] = [];

  for (const [groupLetter, adv] of Object.entries(
    advancementResult.groupAdvancement,
  )) {
    if (!adv) continue;
    const { teams, matches } = groups[groupLetter] ?? {
      teams: [],
      matches: [],
    };
    if (teams.length === 0) continue;

    const manualList = fullManualTieBreaks[groupLetter];
    const chain = manualList
      ? [
          ...DEFAULT_TIEBREAK_CHAIN.slice(0, -1),
          makeManualCriterion(manualList),
          stableCriterion,
        ]
      : DEFAULT_TIEBREAK_CHAIN;

    const standing = computeGroupStanding(teams, matches, chain);
    finishedGroupOrders[groupLetter] = standing;

    // Add 1st and 2nd to advancement
    advancementRefs.push(`1${groupLetter}`);
    advancementRefs.push(`2${groupLetter}`);

    // Collect third-place stats
    if (standing.length >= 3) {
      const third = standing[2];
      const teamMatchesForThird = matches.filter(
        (m) => m.team1 === third || m.team2 === third,
      );
      let pts = 0;
      let gf = 0;
      let ga = 0;
      for (const m of teamMatchesForThird) {
        if (m.team1 === third) {
          gf += m.goals1;
          ga += m.goals2;
          if (m.goals1 > m.goals2) pts += 3;
          else if (m.goals1 === m.goals2) pts += 1;
        } else {
          gf += m.goals2;
          ga += m.goals1;
          if (m.goals2 > m.goals1) pts += 3;
          else if (m.goals2 === m.goals1) pts += 1;
        }
      }
      thirdEntries.push({
        group: groupLetter.toLowerCase(),
        teamId: third,
        points: pts,
        goalDiff: gf - ga,
        goals: gf,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Build thirdPlaceOrder and add thirds to advancement when all 12 complete
  // -------------------------------------------------------------------------
  let thirdPlaceOrder: ThirdPlaceOrder = [];
  const { thirdsAdvancement } = advancementResult;

  if (thirdsAdvancement && thirdEntries.length === 12) {
    const thirdsResult = rankThirds(thirdEntries, fullManualTieBreaks);
    // thirdPlaceOrder uses the "3rd-<groupLetter>" format (lowercase) to match
    // the existing TournamentResult shape used by bracket-core
    thirdPlaceOrder = thirdsResult.ranked.map((r) => `3rd-${r.group}`);

    // Add thirds advancement refs
    for (const r of thirdsResult.ranked) {
      advancementRefs.push(`3rd-1${r.group.toUpperCase()}`);
    }
  }

  // -------------------------------------------------------------------------
  // Derive knockout winners
  // -------------------------------------------------------------------------
  const knockoutWinners = deriveKnockoutWinners(
    liveByNum,
    finishedGroupOrders,
    thirdPlaceOrder,
    advancementRefs,
  );

  return {
    groupOrders,
    thirdPlaceOrder,
    knockoutWinners,
    advancement: advancementRefs,
  };
}

/**
 * Derives knockout winners by replaying all finished knockout LiveResults in
 * round order through the bracket machinery.
 */
function deriveKnockoutWinners(
  liveByNum: Map<number, LiveResult>,
  groupOrders: GroupOrders,
  thirdPlaceOrder: ThirdPlaceOrder,
  advancement: string[],
): Record<string, string> {
  const r32 = buildR32Matches(groupOrders, thirdPlaceOrder, advancement);
  let knockoutMatches = { ...createEmptyKnockoutMatches(), ...r32 };

  const matchIdToNum = buildMatchIdToNumMap();
  const knockoutWinners: Record<string, string> = {};

  const roundOrder: KnockoutRound[] = ["R32", "R16", "QF", "SF"];
  for (const round of roundOrder) {
    const matchIds = Object.keys(knockoutMatches).filter((id) =>
      id.startsWith(round),
    );
    for (const matchId of matchIds) {
      const num = matchIdToNum.get(matchId);
      if (num === undefined) continue;
      const lr = liveByNum.get(num);
      if (!lr || lr.status !== "finished") continue;

      const match = knockoutMatches[matchId];
      if (!match?.team1Id || !match?.team2Id) continue;

      const winner = resolveKnockoutWinner(lr, match.team1Id, match.team2Id);
      if (!winner) continue;

      knockoutMatches = applyWinnerToMatches(knockoutMatches, matchId, winner);
      knockoutWinners[matchId] = winner;
    }
  }

  // Handle 3RD (match 103) and F (match 104)
  for (const [matchId, num] of [
    ["3RD", 103],
    ["F", 104],
  ] as Array<[string, number]>) {
    const lr = liveByNum.get(num);
    if (!lr || lr.status !== "finished") continue;
    const match = knockoutMatches[matchId];
    if (!match?.team1Id || !match?.team2Id) continue;
    const winner = resolveKnockoutWinner(lr, match.team1Id, match.team2Id);
    if (!winner) continue;
    knockoutMatches = applyWinnerToMatches(knockoutMatches, matchId, winner);
    knockoutWinners[matchId] = winner;
  }

  return knockoutWinners;
}

// ---------------------------------------------------------------------------
// Exported utilities (previously in tournament.ts)
// ---------------------------------------------------------------------------

/**
 * All valid R32 slot references for the advancement set.
 * Includes group winners (1A–1L), runners-up (2A–2L), and the 8 thirds slots.
 */
export const VALID_ADVANCEMENT_REFS = new Set([
  // Winners
  "1A",
  "1B",
  "1C",
  "1D",
  "1E",
  "1F",
  "1G",
  "1H",
  "1I",
  "1J",
  "1K",
  "1L",
  // Runners-up
  "2A",
  "2B",
  "2C",
  "2D",
  "2E",
  "2F",
  "2G",
  "2H",
  "2I",
  "2J",
  "2K",
  "2L",
  // Third-place slots
  "3rd-1A",
  "3rd-1B",
  "3rd-1D",
  "3rd-1E",
  "3rd-1G",
  "3rd-1I",
  "3rd-1K",
  "3rd-1L",
]);

/**
 * Computes the actual team occupant of each R32 slot given the group orders
 * and third-place order.  Returns null for slots whose group is not yet settled.
 */
export function getR32SlotOccupants(
  groupOrders: GroupOrders,
  thirdPlaceOrder: ThirdPlaceOrder,
  combinations: Record<string, Record<string, string>>,
): Record<string, string | null> {
  const occupants: Record<string, string | null> = {};

  const groups = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
  for (const g of groups) {
    occupants[`1${g}`] = groupOrders[g]?.[0] ?? null;
    occupants[`2${g}`] = groupOrders[g]?.[1] ?? null;
  }

  const top8Letters = thirdPlaceOrder.slice(0, 8).map((id) => id.split("-")[1]);
  const combinationKey = [...top8Letters].sort().join("");
  const combinationMap = combinations[combinationKey] ?? {};

  const thirdPlaceOpponents = ["1E", "1I", "1A", "1L", "1D", "1G", "1B", "1K"];
  for (const opponent of thirdPlaceOpponents) {
    const lookupKey = `${opponent[0]}${opponent.slice(1).toLowerCase()}`;
    const thirdSlot = combinationMap[lookupKey];
    let teamId: string | null = null;
    if (thirdSlot) {
      const groupLetter = thirdSlot[1].toUpperCase();
      teamId = groupOrders[groupLetter]?.[2] ?? null;
    }
    occupants[`3rd-${opponent}`] = teamId;
  }

  return occupants;
}

// ---------------------------------------------------------------------------

/**
 * Builds the full knockout bracket view from LiveResults + manual tie-breaks.
 *
 * This is the on-read derivation used by `Tournament.bracketView()` and
 * `getActualScoreableContent()`.
 */
export function buildBracketView(
  liveResults: LiveResult[],
  manualTieBreaks: Record<string, string[]>,
  thirdPlaceManualOrder: string[] | null,
  options?: DeriveOptions,
): Record<string, KnockoutMatch> {
  const derived = deriveResult(
    liveResults,
    manualTieBreaks,
    thirdPlaceManualOrder,
    options,
  );
  return computeTournamentBracket(derived);
}

/**
 * Builds the knockout bracket from a DerivedResult.
 * Replays the bracket machinery using already-derived data.
 */
export function computeTournamentBracket(
  derived: DerivedResult,
): Record<string, KnockoutMatch> {
  const r32 = buildR32Matches(
    derived.groupOrders,
    derived.thirdPlaceOrder,
    derived.advancement,
  );
  let knockoutMatches = { ...createEmptyKnockoutMatches(), ...r32 };

  // Apply knockout winners in round order
  const sorted = Object.entries(derived.knockoutWinners).sort(
    ([aId], [bId]) => {
      const aRound = aId.replace(/-\d+$/, "") as KnockoutRound;
      const bRound = bId.replace(/-\d+$/, "") as KnockoutRound;
      return (
        (ROUND_ORDER.indexOf(aRound) ?? 99) -
        (ROUND_ORDER.indexOf(bRound) ?? 99)
      );
    },
  );

  for (const [matchId, winnerId] of sorted) {
    const match = knockoutMatches[matchId];
    if (match && (match.team1Id === winnerId || match.team2Id === winnerId)) {
      knockoutMatches = applyWinnerToMatches(
        knockoutMatches,
        matchId,
        winnerId,
      );
    }
  }

  return knockoutMatches;
}

/**
 * Returns true when the competition has ended — both the third-place match
 * (num=103) and the Final (num=104) are finished.
 *
 * Per ADR 0015: Competition End is derived from LiveResults, not a stored flag.
 */
export function isCompetitionEndedFromLiveResults(
  liveResults: LiveResult[],
): boolean {
  const byNum = new Map<number, LiveResult>(
    liveResults.map((lr) => [lr.num, lr]),
  );
  const match103 = byNum.get(103);
  const match104 = byNum.get(104);
  return match103?.status === "finished" && match104?.status === "finished";
}

// ---------------------------------------------------------------------------
// Tie-info derivation for the Admin exception-review panel
// ---------------------------------------------------------------------------

/**
 * Per-group tie info: the current standing order and which team clusters
 * remain unresolved after the automatic rules (need a manual drag-order).
 */
export type GroupTieInfo = {
  /** Current standing order (team IDs, from top to bottom). */
  standing: TeamId[];
  /**
   * Clusters of team IDs that are still tied after automatic criteria.
   * Each sub-array is a cluster of >= 2 teams that need admin intervention.
   * Empty array = no ties.
   */
  tieClusters: TeamId[][];
};

/**
 * Tie info result from `deriveTieInfo`.
 */
export type TieInfoResult = {
  /** Per-group tie info, keyed by uppercase group letter (e.g. "A"). */
  groups: Record<string, GroupTieInfo>;
  /**
   * Thirds tie clusters. Non-empty only when all 12 groups are complete
   * and at least two thirds share identical stats.
   */
  thirdsTieClusters: TeamId[][];
};

/**
 * Derives the current standing and unresolved tie clusters for all groups and
 * the thirds ranking. Used to power the Admin tie-break ordering UI.
 *
 * Only `finished` matches are considered (provisional standings from live
 * matches are not actionable for the manual tie-break).
 */
export function deriveTieInfo(
  liveResults: LiveResult[],
  manualTieBreaks: Record<string, TeamId[]>,
  thirdPlaceManualOrder: TeamId[] | null,
): TieInfoResult {
  const nameToId = buildNameToIdMap();
  const allMatchesData = getAllMatches();
  const liveByNum = new Map<number, LiveResult>(
    liveResults.map((lr) => [lr.num, lr]),
  );

  const groupsData = getGroups("en");
  const groupsMap: Record<string, { teams: TeamId[]; matches: GroupMatch[] }> =
    {};

  for (const groupData of groupsData) {
    const groupLetter = groupData.group;
    const groupName = `Group ${groupLetter}`;
    const teamIds = groupData.teams.map((t) => t.id);
    const groupMatches: GroupMatch[] = [];

    for (const m of allMatchesData) {
      if (m.group !== groupName) continue;
      const lr = liveByNum.get(m.num);
      if (!lr) continue;
      const team1Id = nameToId.get(m.team1);
      const team2Id = nameToId.get(m.team2);
      if (!team1Id || !team2Id) continue;
      groupMatches.push({
        num: m.num,
        team1: team1Id,
        team2: team2Id,
        goals1: lr.goals1,
        goals2: lr.goals2,
        status: lr.status,
        group: groupLetter,
      });
    }

    groupsMap[groupLetter] = { teams: teamIds, matches: groupMatches };
  }

  const fullManualTieBreaks: Record<string, TeamId[]> = { ...manualTieBreaks };
  if (thirdPlaceManualOrder) {
    fullManualTieBreaks.thirds = thirdPlaceManualOrder;
  }

  // Build per-group results
  const groups: Record<string, GroupTieInfo> = {};

  for (const [groupLetter, { teams, matches }] of Object.entries(groupsMap)) {
    const finishedMatches = matches.filter((m) => m.status === "finished");

    const manualList = fullManualTieBreaks[groupLetter];
    const chain = manualList
      ? [
          ...DEFAULT_TIEBREAK_CHAIN.slice(0, -1),
          makeManualCriterion(manualList),
          stableCriterion,
        ]
      : DEFAULT_TIEBREAK_CHAIN;

    const standing = computeGroupStanding(teams, finishedMatches, chain);
    const tieClusters = detectGroupTies(teams, finishedMatches);

    groups[groupLetter] = { standing, tieClusters };
  }

  // Build thirds tier info
  const allGroupsComplete = Object.values(groupsMap).every(
    ({ matches }) =>
      matches.filter((m) => m.status === "finished").length === 6,
  );

  let thirdsTieClusters: TeamId[][] = [];

  if (allGroupsComplete) {
    const thirdEntries: ThirdPlaceEntry[] = [];

    for (const [groupLetter, { teams, matches }] of Object.entries(groupsMap)) {
      const finishedMatches = matches.filter((m) => m.status === "finished");
      const manualList = fullManualTieBreaks[groupLetter];
      const chain = manualList
        ? [
            ...DEFAULT_TIEBREAK_CHAIN.slice(0, -1),
            makeManualCriterion(manualList),
            stableCriterion,
          ]
        : DEFAULT_TIEBREAK_CHAIN;

      const standing = computeGroupStanding(teams, finishedMatches, chain);
      if (standing.length >= 3) {
        const third = standing[2];
        const teamMatches = finishedMatches.filter(
          (m) => m.team1 === third || m.team2 === third,
        );
        let pts = 0;
        let gf = 0;
        let ga = 0;
        for (const m of teamMatches) {
          if (m.team1 === third) {
            gf += m.goals1;
            ga += m.goals2;
            if (m.goals1 > m.goals2) pts += 3;
            else if (m.goals1 === m.goals2) pts += 1;
          } else {
            gf += m.goals2;
            ga += m.goals1;
            if (m.goals2 > m.goals1) pts += 3;
            else if (m.goals2 === m.goals1) pts += 1;
          }
        }
        thirdEntries.push({
          group: groupLetter.toLowerCase(),
          teamId: third,
          points: pts,
          goalDiff: gf - ga,
          goals: gf,
        });
      }
    }

    if (thirdEntries.length === 12) {
      thirdsTieClusters = detectThirdsTies(thirdEntries);
    }
  }

  return { groups, thirdsTieClusters };
}
