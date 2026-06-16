import combinationsData from "@/../data/worldcup.combinations.json";

/**
 * A team identifier — any string that uniquely identifies a team.
 */
export type TeamId = string;

/**
 * A group-stage match scoreline, sourced from LiveResults.
 * Only `finished` scorelines feed advancement; `live` scorelines feed provisional standings.
 */
export type GroupMatch = {
  num: number;
  team1: TeamId;
  team2: TeamId;
  goals1: number;
  goals2: number;
  status: "upcoming" | "live" | "finished";
  group?: string;
};

/**
 * The context passed to a TieBreakCriterion.
 * Extensible: future criteria can add fields (cards, overall GD, etc.)
 * without touching the engine.
 */
export type TieBreakContext = {
  cluster: TeamId[];
  matches: GroupMatch[];
};

/**
 * A single refinement criterion in the tie-break chain.
 *
 * Takes a cluster of teams and the relevant matches, and returns an ordered
 * list of sub-clusters. A sub-cluster of size >= 2 is still tied and will be
 * passed to the next criterion.
 */
export type TieBreakCriterion = (ctx: TieBreakContext) => TeamId[][];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Returns match points for a team (3 win, 1 draw, 0 loss). */
function matchPoints(team: TeamId, m: GroupMatch): number {
  if (m.team1 === team) {
    if (m.goals1 > m.goals2) return 3;
    if (m.goals1 === m.goals2) return 1;
    return 0;
  }
  if (m.team2 === team) {
    if (m.goals2 > m.goals1) return 3;
    if (m.goals2 === m.goals1) return 1;
    return 0;
  }
  return 0;
}

/** Returns goals scored by `team` in match `m`. */
function goalsFor(team: TeamId, m: GroupMatch): number {
  if (m.team1 === team) return m.goals1;
  if (m.team2 === team) return m.goals2;
  return 0;
}

/** Returns goals conceded by `team` in match `m`. */
function goalsAgainst(team: TeamId, m: GroupMatch): number {
  if (m.team1 === team) return m.goals2;
  if (m.team2 === team) return m.goals1;
  return 0;
}

/** Filters matches to only those between teams in the cluster. */
function clusterMatches(
  cluster: TeamId[],
  matches: GroupMatch[],
): GroupMatch[] {
  const set = new Set(cluster);
  return matches.filter((m) => set.has(m.team1) && set.has(m.team2));
}

/**
 * Groups teams from `cluster` into sub-clusters based on a score function.
 * Teams with higher score come first. Teams with equal score stay together.
 * Preserves relative order within equal-score groups (stable).
 */
function groupByScore(
  cluster: TeamId[],
  scoreFn: (team: TeamId) => number,
): TeamId[][] {
  // Compute scores
  const scored = cluster.map((t) => ({ t, score: scoreFn(t) }));

  // Find distinct score values in descending order
  const scoreValues = [...new Set(scored.map((s) => s.score))].sort(
    (a, b) => b - a,
  );

  // Group teams by score, preserving input order within group
  const groups: TeamId[][] = scoreValues.map((score) =>
    scored.filter((s) => s.score === score).map((s) => s.t),
  );

  return groups;
}

// ---------------------------------------------------------------------------
// Built-in criteria
// ---------------------------------------------------------------------------

/**
 * Head-to-head points criterion.
 * Only considers matches between teams in the cluster.
 */
export const h2hPointsCriterion: TieBreakCriterion = (ctx) => {
  const h2h = clusterMatches(ctx.cluster, ctx.matches);
  return groupByScore(ctx.cluster, (t) =>
    h2h.reduce((sum, m) => sum + matchPoints(t, m), 0),
  );
};

/**
 * Head-to-head goal difference criterion.
 * Only considers matches between teams in the cluster.
 */
export const h2hGoalDiffCriterion: TieBreakCriterion = (ctx) => {
  const h2h = clusterMatches(ctx.cluster, ctx.matches);
  return groupByScore(ctx.cluster, (t) =>
    h2h.reduce((sum, m) => sum + goalsFor(t, m) - goalsAgainst(t, m), 0),
  );
};

/**
 * Head-to-head goals scored criterion.
 * Only considers matches between teams in the cluster.
 */
export const h2hGoalsCriterion: TieBreakCriterion = (ctx) => {
  const h2h = clusterMatches(ctx.cluster, ctx.matches);
  return groupByScore(ctx.cluster, (t) =>
    h2h.reduce((sum, m) => sum + goalsFor(t, m), 0),
  );
};

/**
 * Overall goal difference criterion (FIFA criterion 4).
 * Considers all group matches for each team in the cluster, not just h2h.
 */
export const overallGoalDiffCriterion: TieBreakCriterion = (ctx) => {
  return groupByScore(ctx.cluster, (t) =>
    ctx.matches
      .filter((m) => m.team1 === t || m.team2 === t)
      .reduce((sum, m) => sum + goalsFor(t, m) - goalsAgainst(t, m), 0),
  );
};

/**
 * Overall goals scored criterion (FIFA criterion 5).
 * Considers all group matches for each team in the cluster, not just h2h.
 */
export const overallGoalsCriterion: TieBreakCriterion = (ctx) => {
  return groupByScore(ctx.cluster, (t) =>
    ctx.matches
      .filter((m) => m.team1 === t || m.team2 === t)
      .reduce((sum, m) => sum + goalsFor(t, m), 0),
  );
};

/**
 * Stable criterion — the terminal fallback.
 * Returns the cluster as individual singletons in the original input order.
 * This is never alphabetical: it preserves the order in which teams appear
 * in the `cluster` array (which itself comes from the previous ranking step).
 */
export const stableCriterion: TieBreakCriterion = (ctx) => {
  return ctx.cluster.map((t) => [t]);
};

/**
 * Creates a manual tie-break criterion from Admin-supplied numeric factors.
 * Sorts tied clusters of teams by their factors descending.
 * If factors are equal or not defined, they remain tied so fallback rules can apply.
 *
 * Because this criterion runs after points and h2h, it can only order teams
 * that the earlier rules left in the same cluster. It cannot reorder teams
 * already separated by points or head-to-head.
 */
export function makeManualFactorCriterion(
  factors: Record<string, number>,
): TieBreakCriterion {
  return (ctx) => {
    return groupByScore(ctx.cluster, (t) => factors[t] ?? 0);
  };
}

// ---------------------------------------------------------------------------
// Default chain
// ---------------------------------------------------------------------------

/**
 * The default tie-break chain:
 * points → h2h points → h2h goal-diff → h2h goals → stable
 *
 * The Manual Tie-Break is inserted before stable by the caller when needed.
 */
export const DEFAULT_TIEBREAK_CHAIN: TieBreakCriterion[] = [
  h2hPointsCriterion,
  h2hGoalDiffCriterion,
  h2hGoalsCriterion,
  overallGoalDiffCriterion,
  overallGoalsCriterion,
  stableCriterion,
];

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Runs a cluster through the tie-break chain until all clusters are singletons
 * or the chain is exhausted.
 */
function refineCluster(
  cluster: TeamId[],
  matches: GroupMatch[],
  chain: TieBreakCriterion[],
): TeamId[] {
  if (cluster.length <= 1 || chain.length === 0) {
    return cluster;
  }

  const [criterion, ...rest] = chain;
  const subClusters = criterion({ cluster, matches });

  const result: TeamId[] = [];
  for (const sub of subClusters) {
    if (sub.length <= 1) {
      result.push(...sub);
    } else {
      // Still tied — pass to next criterion
      result.push(...refineCluster(sub, matches, rest));
    }
  }
  return result;
}

/** Compute overall group points for a team across all group matches. */
function totalPoints(team: TeamId, matches: GroupMatch[]): number {
  return matches
    .filter((m) => m.team1 === team || m.team2 === team)
    .reduce((sum, m) => sum + matchPoints(team, m), 0);
}

/**
 * Computes the standing order for a group.
 *
 * 1. Sorts all teams by overall points (highest first).
 * 2. For each tied cluster, runs the chain of refinement criteria.
 *
 * The `criteria` array is the full chain after points. The default chain
 * handles h2h points → h2h GD → h2h goals → stable.
 *
 * All functions are pure; no IO.
 */
export function computeGroupStanding(
  teams: TeamId[],
  matches: GroupMatch[],
  criteria: TieBreakCriterion[],
): TeamId[] {
  // Step 1: group by overall points
  const byPoints = groupByScore(teams, (t) => totalPoints(t, matches));

  // Step 2: for each tied cluster (size >= 2), refine with criteria chain
  const result: TeamId[] = [];
  for (const cluster of byPoints) {
    if (cluster.length === 1) {
      result.push(cluster[0]);
    } else {
      result.push(...refineCluster(cluster, matches, criteria));
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Thirds ranking
// ---------------------------------------------------------------------------

export type ThirdPlaceEntry = {
  group: string; // lowercase letter, e.g. "a"
  teamId: TeamId;
  points: number;
  goalDiff: number;
  goals: number;
};

export type RankedThird = ThirdPlaceEntry & {
  rank: number;
};

export type ThirdsResult = {
  ranked: RankedThird[];
  allRanked: TeamId[]; // all 12 thirds in tie-break order (same sort, full list)
  slotAssignments: Record<string, TeamId>; // R32 slot label → teamId
};

/**
 * Ranks the 12 third-placed teams and selects the top 8.
 * Uses the same refinement approach: points → GD → goals → stable (by group letter).
 *
 * `manualTieBreaks` can provide a manual order for the thirds cluster if needed.
 */
export function rankThirds(
  thirds: ThirdPlaceEntry[],
  manualTieBreaks: Record<string, Record<string, number>>,
): ThirdsResult {
  // Sort by points desc, then GD desc, then goals desc, then stable (group letter order)
  const teamIds = thirds.map((t) => t.teamId);

  const thirdsMap = new Map<TeamId, ThirdPlaceEntry>(
    thirds.map((t) => [t.teamId, t]),
  );

  // Build simple criteria from the thirds stats (not h2h — cross-group)
  const pointsCriterion: TieBreakCriterion = (ctx) =>
    groupByScore(ctx.cluster, (t) => thirdsMap.get(t)?.points ?? 0);

  const gdCriterion: TieBreakCriterion = (ctx) =>
    groupByScore(ctx.cluster, (t) => thirdsMap.get(t)?.goalDiff ?? 0);

  const goalsCriterion: TieBreakCriterion = (ctx) =>
    groupByScore(ctx.cluster, (t) => thirdsMap.get(t)?.goals ?? 0);

  // Stable by group letter (alphabetical for the thirds — not team name)
  const stableByGroup: TieBreakCriterion = (ctx) => {
    const sorted = [...ctx.cluster].sort((a, b) => {
      const ga = thirdsMap.get(a)?.group ?? "";
      const gb = thirdsMap.get(b)?.group ?? "";
      return ga.localeCompare(gb);
    });
    return sorted.map((t) => [t]);
  };

  // Optional manual override for thirds
  const manualFactors = manualTieBreaks.thirds;
  const thirdsChain: TieBreakCriterion[] = [
    pointsCriterion,
    gdCriterion,
    goalsCriterion,
    ...(manualFactors ? [makeManualFactorCriterion(manualFactors)] : []),
    stableByGroup,
  ];

  // Rank all 12 using same engine (no overall-points first pass needed — we use criterion chain directly)
  const ranked = refineCluster(teamIds, [], thirdsChain);

  // Top 8
  const top8 = ranked.slice(0, 8);

  // Build combination key: sorted group letters of the top 8
  const qualifyingGroups = top8
    .map((t) => thirdsMap.get(t)?.group ?? "")
    .sort()
    .join("");

  // Look up slot assignments from combinations table
  const combinations = combinationsData as Record<
    string,
    Record<string, string>
  >;
  const slotMap = combinations[qualifyingGroups] ?? {};

  // Map slot labels to team IDs
  // slotMap is like { "1a": "3e", "1b": "3g", ... }
  // where "3x" means "third of group x"
  const groupToTeam = new Map<string, TeamId>(
    top8.map((t) => [thirdsMap.get(t)?.group ?? "", t]),
  );

  const slotAssignments: Record<string, TeamId> = {};
  for (const [slot, groupRef] of Object.entries(slotMap)) {
    // groupRef is like "3e" meaning "third of group e"
    const groupLetter = groupRef.slice(1); // "e"
    const teamId = groupToTeam.get(groupLetter);
    if (teamId) {
      slotAssignments[slot] = teamId;
    }
  }

  const rankedResult: RankedThird[] = top8.map((t, i) => ({
    ...(thirdsMap.get(t) as ThirdPlaceEntry),
    rank: i + 1,
  }));

  return { ranked: rankedResult, allRanked: ranked, slotAssignments };
}

// ---------------------------------------------------------------------------
// Advancement predicate
// ---------------------------------------------------------------------------

export type GroupAdvancement = {
  first: TeamId;
  second: TeamId;
  third: TeamId;
};

export type AdvancementInput = {
  groups: Record<string, { teams: TeamId[]; matches: GroupMatch[] }>;
  tieBreakChain: TieBreakCriterion[];
  manualTieBreaks: Record<string, Record<string, number>>;
  finishedOnly: boolean;
  provisional?: boolean;
};

export type AdvancementResult = {
  /** Settled group advancement (top-2 + third), keyed by group letter. */
  groupAdvancement: Record<string, GroupAdvancement | undefined>;
  /** Settled thirds advancement — only present when ALL 12 groups are complete. */
  thirdsAdvancement?: {
    qualified: TeamId[];
    slotAssignments: Record<string, TeamId>;
  };
};

/** Returns true if all 6 matches in a group are finished (no live matches). */
function isGroupComplete(matches: GroupMatch[]): boolean {
  return matches.length === 6 && matches.every((m) => m.status === "finished");
}

/**
 * Computes which teams have advanced from their groups and (when all 12 groups
 * are complete) which third-placed teams have advanced.
 *
 * Rules:
 * - A group's top-2 settle only when all 6 of its matches are `finished`.
 * - The 8 thirds settle only when all 12 groups are `finished`.
 * - `live` matches never settle a slot.
 * - When a group is not yet settled, `groupAdvancement[g]` is `undefined`.
 */
export function getAdvancement(input: AdvancementInput): AdvancementResult {
  const groupAdvancement: Record<string, GroupAdvancement | undefined> = {};

  const thirdsEntries: ThirdPlaceEntry[] = [];
  let allGroupsComplete = true;

  for (const [groupKey, { teams, matches }] of Object.entries(input.groups)) {
    if (input.provisional) {
      const started = matches.length >= 1;
      if (!started) {
        groupAdvancement[groupKey] = undefined;
        continue;
      }
    } else {
      const complete = isGroupComplete(matches);
      if (!complete) {
        allGroupsComplete = false;
        // When finishedOnly is true (default), skip incomplete groups entirely.
        // When finishedOnly is false, compute provisional standings using whatever
        // matches are available (live and finished alike).
        if (input.finishedOnly) {
          groupAdvancement[groupKey] = undefined;
          continue;
        }
      }
    }

    // Build criteria with manual tie-break if provided
    const manualFactors = input.manualTieBreaks[groupKey];
    const chain: TieBreakCriterion[] = manualFactors
      ? [
          ...input.tieBreakChain.slice(0, -1), // drop stable
          makeManualFactorCriterion(manualFactors),
          stableCriterion,
        ]
      : input.tieBreakChain;

    const standing = computeGroupStanding(teams, matches, chain);
    if (standing.length < 4) {
      throw new Error(
        `Group ${groupKey}: expected 4 standings, got ${standing.length}`,
      );
    }
    const [first, second, third] = standing as [TeamId, TeamId, TeamId, TeamId];

    groupAdvancement[groupKey] = { first, second, third };

    // Collect third-place team stats for cross-group ranking
    const thirdStats = computeThirdStats(third, matches);
    thirdsEntries.push({
      group: groupKey,
      teamId: third,
      points: thirdStats.points,
      goalDiff: thirdStats.goalDiff,
      goals: thirdStats.goals,
    });
  }

  // Thirds advance only when all 12 groups are complete (or in provisional mode, all 12 groups have started)
  if (input.provisional) {
    const allTwelveStarted = thirdsEntries.length === 12;
    if (allTwelveStarted) {
      const thirdsResult = rankThirds(thirdsEntries, input.manualTieBreaks);
      return {
        groupAdvancement,
        thirdsAdvancement: {
          qualified: thirdsResult.ranked.map((r) => r.teamId),
          slotAssignments: thirdsResult.slotAssignments,
        },
      };
    }
    return { groupAdvancement, thirdsAdvancement: undefined };
  }

  const allTwelveComplete =
    allGroupsComplete && Object.keys(input.groups).length === 12;

  if (!allTwelveComplete) {
    return { groupAdvancement, thirdsAdvancement: undefined };
  }

  const thirdsResult = rankThirds(thirdsEntries, input.manualTieBreaks);
  return {
    groupAdvancement,
    thirdsAdvancement: {
      qualified: thirdsResult.ranked.map((r) => r.teamId),
      slotAssignments: thirdsResult.slotAssignments,
    },
  };
}

// ---------------------------------------------------------------------------
// Tie detection
// ---------------------------------------------------------------------------

/**
 * Detects unresolved tie clusters in a group's standing.
 *
 * Returns the list of clusters that remain tied after applying all automatic
 * criteria (points → h2h points → h2h GD → h2h goals) but before the
 * manual or stable fallback.
 *
 * An unresolved tie means the Admin must drag-reorder that cluster in the UI.
 * Teams separated by the automatic rules are "pinned" — not in any returned
 * cluster.
 *
 * Only considers `finished` matches (ties in provisional standings are not
 * actionable until the group is complete).
 */
export function detectGroupTies(
  teams: TeamId[],
  matches: GroupMatch[],
): TeamId[][] {
  const finishedMatches = matches.filter((m) => m.status === "finished");

  // Step 1: group by overall points
  const byPoints = groupByScore(teams, (t) =>
    finishedMatches
      .filter((m) => m.team1 === t || m.team2 === t)
      .reduce((sum, m) => sum + matchPoints(t, m), 0),
  );

  // Automatic chain without manual or stable
  const autoChain: TieBreakCriterion[] = [
    h2hPointsCriterion,
    h2hGoalDiffCriterion,
    h2hGoalsCriterion,
    overallGoalDiffCriterion,
    overallGoalsCriterion,
  ];

  const tieClusters: TeamId[][] = [];

  for (const cluster of byPoints) {
    if (cluster.length <= 1) continue;

    // Run cluster through autoChain, collecting any remaining tied sub-clusters
    const remaining = findRemainingTies(cluster, finishedMatches, autoChain);
    tieClusters.push(...remaining);
  }

  return tieClusters;
}

/**
 * Detects unresolved tie clusters among thirds.
 *
 * Returns the list of clusters that remain tied after the automatic thirds
 * criteria (points → GD → goals) but before manual or stable.
 *
 * Only meaningful when all 12 groups have finished (thirds ranking only
 * settles then).
 */
export function detectThirdsTies(thirds: ThirdPlaceEntry[]): TeamId[][] {
  const thirdsMap = new Map<TeamId, ThirdPlaceEntry>(
    thirds.map((t) => [t.teamId, t]),
  );
  const teamIds = thirds.map((t) => t.teamId);

  const pointsCriterion: TieBreakCriterion = (ctx) =>
    groupByScore(ctx.cluster, (t) => thirdsMap.get(t)?.points ?? 0);
  const gdCriterion: TieBreakCriterion = (ctx) =>
    groupByScore(ctx.cluster, (t) => thirdsMap.get(t)?.goalDiff ?? 0);
  const goalsCriterion: TieBreakCriterion = (ctx) =>
    groupByScore(ctx.cluster, (t) => thirdsMap.get(t)?.goals ?? 0);

  const autoChain: TieBreakCriterion[] = [
    pointsCriterion,
    gdCriterion,
    goalsCriterion,
  ];

  // Rank all 12 by the criteria chain (no points pre-pass for thirds)
  return findRemainingTies(teamIds, [], autoChain);
}

/**
 * Internal helper: runs `cluster` through `chain` and returns sub-clusters
 * that remain tied (size >= 2) after the chain is exhausted.
 */
function findRemainingTies(
  cluster: TeamId[],
  matches: GroupMatch[],
  chain: TieBreakCriterion[],
): TeamId[][] {
  if (cluster.length <= 1 || chain.length === 0) {
    return cluster.length >= 2 ? [cluster] : [];
  }

  const [criterion, ...rest] = chain;
  const subClusters = criterion({ cluster, matches });

  const stillTied: TeamId[][] = [];
  for (const sub of subClusters) {
    if (sub.length <= 1) continue;
    stillTied.push(...findRemainingTies(sub, matches, rest));
  }
  return stillTied;
}

// ---------------------------------------------------------------------------
// Internal: compute third-place team stats
// ---------------------------------------------------------------------------

function computeThirdStats(
  team: TeamId,
  matches: GroupMatch[],
): { points: number; goalDiff: number; goals: number } {
  const teamMatches = matches.filter(
    (m) => m.team1 === team || m.team2 === team,
  );
  let points = 0;
  let gf = 0;
  let ga = 0;
  for (const m of teamMatches) {
    points += matchPoints(team, m);
    gf += goalsFor(team, m);
    ga += goalsAgainst(team, m);
  }
  return { points, goalDiff: gf - ga, goals: gf };
}

// ---------------------------------------------------------------------------
// Standings table derivation
// ---------------------------------------------------------------------------

/**
 * A single row in the standings table, ready for rendering.
 * Rows carry `teamId` only (locale-agnostic); localisation stays in the
 * component layer per ADR 0004.
 */
export type StandingRow = {
  teamId: TeamId;
  position: number;
  mp: number;
  pts: number;
  gf: number;
  ga: number;
  gd: number;
  qualified: boolean;
};

/**
 * The per-group result of the standings-table derivation.
 * `cut` is 2 for groups whose top-2 advance (if no best-thirds for this group),
 * but since all groups may contribute a third, we always expose 2 here for
 * the top-2 advancement position (rows carry the qualified flag directly).
 */
export type GroupStandingsEntry = {
  rows: StandingRow[];
};

/**
 * The full standings table derived from live results.
 */
export type StandingsTable = {
  /** Per-group standings, keyed by uppercase group letter (e.g. "A"). */
  groups: Record<string, GroupStandingsEntry>;
  /**
   * Ranked best-thirds rows (all 12 when all groups have started matches;
   * empty otherwise). Top 8 are flagged qualified.
   */
  bestThirds: StandingRow[];
};

/**
 * Input shape for `deriveStandingsTable` — same as `AdvancementInput`.
 */
export type StandingsTableInput = AdvancementInput;

/**
 * Computes per-team points, goals-for, goals-against, goal-difference, and
 * qualified flag for every group, and ranks the 12 third-placed teams.
 *
 * Reuses `computeGroupStanding`, `rankThirds`, and the internal
 * `matchPoints` / `goalsFor` / `goalsAgainst` helpers — no shadow tally.
 *
 * The `finishedOnly: false` provisional mode is used for display standings so
 * live matches move the table (ADR 0020). Manual tie-breaks (ADR 0016) are
 * threaded through via `manualTieBreaks`.
 *
 * Qualified semantics:
 * - Before any match is played in a group → all rows qualified.
 * - Once any match is played → pos 1–2 qualify, pos 3 qualifies iff in the
 *   best-eight thirds, pos 4 does not qualify.
 */
export function deriveStandingsTable(
  input: StandingsTableInput,
): StandingsTable {
  // ------------------------------------------------------------------
  // Step 1: compute per-group ordered rows with stats
  // ------------------------------------------------------------------
  const groupsResult: Record<string, GroupStandingsEntry> = {};
  const thirdsEntries: ThirdPlaceEntry[] = [];

  for (const [groupLetter, { teams, matches }] of Object.entries(
    input.groups,
  )) {
    // When finishedOnly is true, exclude live matches from stats and standing computation
    const effectiveMatches = input.finishedOnly
      ? matches.filter((m) => m.status === "finished")
      : matches;
    const isAnyMatchPlayed = effectiveMatches.length > 0;

    // Build criteria chain, inserting manual factor criterion if provided
    const manualFactors = input.manualTieBreaks[groupLetter];
    const chain: TieBreakCriterion[] = manualFactors
      ? [
          ...input.tieBreakChain.slice(0, -1), // drop stable
          makeManualFactorCriterion(manualFactors),
          stableCriterion,
        ]
      : input.tieBreakChain;

    // Get ordered team IDs from the tie-break engine
    const ordered = computeGroupStanding(teams, effectiveMatches, chain);

    // Compute per-team stats
    const rows: StandingRow[] = ordered.map((teamId, idx) => {
      const teamMatches = effectiveMatches.filter(
        (m) => m.team1 === teamId || m.team2 === teamId,
      );
      let pts = 0;
      let gf = 0;
      let ga = 0;
      for (const m of teamMatches) {
        pts += matchPoints(teamId, m);
        gf += goalsFor(teamId, m);
        ga += goalsAgainst(teamId, m);
      }
      const position = idx + 1;
      const mp = teamMatches.length;

      // Qualified defaults to true before any match; after the first match
      // top-2 qualify, pos-4 does not, pos-3 depends on thirds ranking (resolved below).
      const qualified = isAnyMatchPlayed
        ? position <= 2 // pos 3 will be re-evaluated; pos 4 stays false
        : true;

      return { teamId, position, mp, pts, gf, ga, gd: gf - ga, qualified };
    });

    groupsResult[groupLetter] = { rows };

    // Collect third-place team for cross-group ranking
    if (ordered.length >= 3) {
      const third = ordered[2];
      const stats = computeThirdStats(third, effectiveMatches);
      thirdsEntries.push({
        group: groupLetter.toLowerCase(),
        teamId: third,
        points: stats.points,
        goalDiff: stats.goalDiff,
        goals: stats.goals,
      });
    }
  }

  // ------------------------------------------------------------------
  // Step 2: rank thirds and resolve pos-3 qualified flags
  // ------------------------------------------------------------------
  let bestThirdsRows: StandingRow[] = [];

  if (thirdsEntries.length === 12) {
    const thirdsResult = rankThirds(thirdsEntries, input.manualTieBreaks);
    const qualifiedThirdIds = new Set(thirdsResult.ranked.map((r) => r.teamId));

    // Build bestThirds rows from the full ranked list (all 12 thirds in tie-break order)
    // thirdsResult.allRanked contains all 12 in the same order produced by refineCluster,
    // so bottom-4 are also sorted — not in arbitrary insertion order.
    const allRanked = thirdsResult.allRanked;

    bestThirdsRows = allRanked.map((teamId, idx) => {
      const entry = thirdsEntries.find((t) => t.teamId === teamId)!;
      const qualified = idx < 8;
      const groupRow = groupsResult[entry.group.toUpperCase()]?.rows.find(
        (r) => r.teamId === teamId,
      );
      return {
        teamId,
        position: idx + 1,
        mp: groupRow?.mp ?? 0,
        pts: entry.points,
        gf: entry.goals,
        ga: entry.goals - entry.goalDiff, // ga = gf - gd → ga = goals - goalDiff
        gd: entry.goalDiff,
        qualified,
      };
    });

    // Update pos-3 qualified flags in per-group rows
    for (const groupEntry of Object.values(groupsResult)) {
      const pos3Row = groupEntry.rows.find((r) => r.position === 3);
      if (pos3Row) {
        pos3Row.qualified = qualifiedThirdIds.has(pos3Row.teamId);
      }
    }
  }

  return { groups: groupsResult, bestThirds: bestThirdsRows };
}
