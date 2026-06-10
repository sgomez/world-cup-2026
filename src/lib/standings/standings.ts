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
  status: "live" | "finished";
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
 * Stable criterion — the terminal fallback.
 * Returns the cluster as individual singletons in the original input order.
 * This is never alphabetical: it preserves the order in which teams appear
 * in the `cluster` array (which itself comes from the previous ranking step).
 */
export const stableCriterion: TieBreakCriterion = (ctx) => {
  return ctx.cluster.map((t) => [t]);
};

/**
 * Creates a manual tie-break criterion from an Admin-supplied ordered list.
 * Only acts on a cluster — teams not in the cluster are ignored.
 * Teams not mentioned in the manual list retain their current relative order.
 *
 * Because this criterion runs after points and h2h, it can only order teams
 * that the earlier rules left in the same cluster. It cannot reorder teams
 * already separated by points or head-to-head.
 */
export function makeManualCriterion(manualOrder: TeamId[]): TieBreakCriterion {
  return (ctx) => {
    const clusterSet = new Set(ctx.cluster);
    // Only keep entries that are in the cluster
    const ordered = manualOrder.filter((t) => clusterSet.has(t));
    // Teams not mentioned in manualOrder preserve their input order at the end
    const mentioned = new Set(ordered);
    const unmentioned = ctx.cluster.filter((t) => !mentioned.has(t));
    const finalOrder = [...ordered, ...unmentioned];
    // Return as singletons (fully separates all mentioned teams)
    return finalOrder.map((t) => [t]);
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
  manualTieBreaks: Record<string, TeamId[]>,
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
  const manualList = manualTieBreaks["thirds"];
  const thirdsChain: TieBreakCriterion[] = [
    pointsCriterion,
    gdCriterion,
    goalsCriterion,
    ...(manualList ? [makeManualCriterion(manualList)] : []),
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

  return { ranked: rankedResult, slotAssignments };
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
  manualTieBreaks: Record<string, TeamId[]>;
  finishedOnly: boolean;
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
    if (!isGroupComplete(matches)) {
      allGroupsComplete = false;
      groupAdvancement[groupKey] = undefined;
      continue;
    }

    // Build criteria with manual tie-break if provided
    const manualList = input.manualTieBreaks[groupKey];
    const chain: TieBreakCriterion[] = manualList
      ? [
          ...input.tieBreakChain.slice(0, -1), // drop stable
          makeManualCriterion(manualList),
          stableCriterion,
        ]
      : input.tieBreakChain;

    const standing = computeGroupStanding(teams, matches, chain);
    const first = standing[0];
    const second = standing[1];
    const third = standing[2];

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

  // Thirds advance only when all 12 groups are complete
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
