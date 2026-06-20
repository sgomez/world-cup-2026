import type { ResultAsync } from "neverthrow";
import type { DomainError } from "./errors";
import type { PenguinRun, PlayDay } from "./penguin-run";

/**
 * One row in the global Arcade Ranking.
 * Represents a user's best score within the queried period and the first time they achieved it.
 */
export type ArcadeRankingRow = {
  userId: string;
  /** The user's best score across all their finished/finalised Penguin Runs in the period. */
  bestScore: number;
  /**
   * The `startedAt` timestamp of the run in which the user first achieved their
   * best score in the period. Used to break ties deterministically (earlier = higher rank).
   */
  achievedAt: Date;
};

/**
 * Filter for scoping the ranking query to a specific time period.
 *
 * - `playDay` — filter by UTC calendar date string (YYYY-MM-DD) for daily scope.
 * - `startedAtRange` — filter by a date range for weekly scope.
 * - When no filter is provided, all-time ranking is returned.
 */
export type ArcadeRankingFilter =
  | { playDay: string }
  | { startedAtRange: { gte: Date; lte: Date } };

/**
 * Persistence port for the PenguinRun aggregate (ADR 0008).
 * Adapters live in `infrastructure/`.
 *
 * - `findById` — returns the run with the given id, or `null` if none exists.
 * - `findByUserAndPlayDay` — returns any run (any status) for a user on the
 *   given Play Day. Used to enforce the daily limit.
 * - `findAllInProgress` — returns all runs with status `in_progress`.
 *   Used by `getArcadeRanking` to lazily finalise stale runs on read.
 * - `findRanking` — returns one row per User with their best score
 *   (across finished and finalised runs) for the given filter period, and the
 *   timestamp of the run where that score was first achieved. Used by `getArcadeRanking`.
 * - `save` — upserts the run by id.
 */
export interface ArcadeRunRepository {
  findById(id: string): Promise<PenguinRun | null>;
  findByUserAndPlayDay(
    userId: string,
    playDay: PlayDay,
  ): Promise<PenguinRun | null>;
  findAllInProgress(): Promise<PenguinRun[]>;
  findRanking(filter?: ArcadeRankingFilter): Promise<ArcadeRankingRow[]>;
  save(run: PenguinRun): ResultAsync<void, DomainError>;
}
