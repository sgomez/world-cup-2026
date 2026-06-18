import type { ArcadeRunRepository } from "../domain/arcade-run-repository";

export type ArcadeRankingEntry = {
  rank: number;
  userId: string;
  userName: string;
  bestScore: number;
  achievedAt: Date;
};

export type GetArcadeRankingQuery = {
  /** Injected server clock — never trust client time. */
  clock: () => Date;
  /**
   * Heartbeat lapse threshold in milliseconds.
   * In-progress runs whose `lastSeenAt` is older than this are finalised
   * server-side before the ranking is computed (lazy sweep, ADR 0034).
   */
  staleTolerance: number;
  /**
   * Optional name resolver. When provided, each entry's `userName` is resolved
   * via this seam (symmetric with the betting Leaderboard NameResolver). Falls
   * back to `userId` when the resolver returns null or is omitted.
   */
  nameResolver?: (userId: string) => Promise<string | null>;
};

/**
 * `getArcadeRanking` use case.
 *
 * Returns the global Arcade Ranking: one entry per User, ordered descending
 * by all-time best score; ties broken by earliest `achievedAt` (the
 * `startedAt` timestamp of the run in which the user first achieved the score).
 *
 * Before querying, it lazily finalises any in_progress runs whose heartbeat
 * has lapsed beyond `staleTolerance` — recording the best Round score they
 * had accumulated so far (ADR 0034). No new scheduler is introduced.
 *
 * Excludes users whose best score is 0.
 */
export async function getArcadeRanking(
  repo: ArcadeRunRepository,
  query: GetArcadeRankingQuery,
): Promise<ArcadeRankingEntry[]> {
  const now = query.clock();

  // Lazy sweep: finalise stale in_progress runs.
  const inProgress = await repo.findAllInProgress();
  const stale = inProgress.filter((run) =>
    run.isStale(now, query.staleTolerance),
  );

  // Finalise each stale run sequentially (errors are swallowed — best effort).
  for (const run of stale) {
    const finalised = run.finalise(now);
    await repo.save(finalised).match(
      () => undefined,
      () => undefined, // persist error is non-fatal for ranking read
    );
  }

  // Query all-time ranking rows (finished + finalised, best score per user).
  const rows = await repo.findAllTimeRanking();

  // Sort: descending score, then ascending achievedAt for tie-break.
  rows.sort((a, b) => {
    if (b.bestScore !== a.bestScore) return b.bestScore - a.bestScore;
    return a.achievedAt.getTime() - b.achievedAt.getTime();
  });

  // Resolve user names in parallel when a NameResolver is provided.
  const entries = await Promise.all(
    rows.map(async (row, index) => {
      const resolved = query.nameResolver
        ? await query.nameResolver(row.userId)
        : null;
      return {
        rank: index + 1,
        userId: row.userId,
        userName: resolved ?? row.userId,
        bestScore: row.bestScore,
        achievedAt: row.achievedAt,
      };
    }),
  );

  return entries;
}
