import type { ResultAsync } from "neverthrow";
import type { DomainError } from "./errors";
import type { PenguinRun, PlayDay } from "./penguin-run";

/**
 * One row in the global Arcade Ranking.
 * Represents a user's all-time best score and the first time they achieved it.
 */
export type ArcadeRankingRow = {
  userId: string;
  /** The user's all-time best score across all their finished/finalised Penguin Runs. */
  bestScore: number;
  /**
   * The `startedAt` timestamp of the run in which the user first achieved their
   * all-time best score. Used to break ties deterministically (earlier = higher rank).
   */
  achievedAt: Date;
};

/**
 * Persistence port for the PenguinRun aggregate (ADR 0008).
 * Adapters live in `infrastructure/`.
 *
 * - `findById` — returns the run with the given id, or `null` if none exists.
 * - `findByUserAndPlayDay` — returns any run (any status) for a user on the
 *   given Play Day. Used to enforce the daily limit.
 * - `findAllInProgress` — returns all runs with status `in_progress`.
 *   Used by `getArcadeRanking` to lazily finalise stale runs on read.
 * - `findAllTimeRanking` — returns one row per User with their all-time best
 *   score (across finished and finalised runs) and the timestamp of the run
 *   where that score was first achieved. Used by `getArcadeRanking`.
 * - `save` — upserts the run by id.
 */
export interface ArcadeRunRepository {
  findById(id: string): Promise<PenguinRun | null>;
  findByUserAndPlayDay(
    userId: string,
    playDay: PlayDay,
  ): Promise<PenguinRun | null>;
  findAllInProgress(): Promise<PenguinRun[]>;
  findAllTimeRanking(): Promise<ArcadeRankingRow[]>;
  save(run: PenguinRun): ResultAsync<void, DomainError>;
}
