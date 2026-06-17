import type { ResultAsync } from "neverthrow";
import type { DomainError } from "./errors";
import type { PenguinRun, PlayDay } from "./penguin-run";

/**
 * Persistence port for the PenguinRun aggregate (ADR 0008).
 * Adapters live in `infrastructure/`.
 *
 * - `findById` — returns the run with the given id, or `null` if none exists.
 * - `findByUserAndPlayDay` — returns any run (any status) for a user on the
 *   given Play Day. Used to enforce the daily limit.
 * - `findAllInProgress` — returns all runs with status `in_progress`.
 *   Used by `getArcadeRanking` to lazily finalise stale runs on read.
 * - `save` — upserts the run by id.
 */
export interface ArcadeRunRepository {
  findById(id: string): Promise<PenguinRun | null>;
  findByUserAndPlayDay(
    userId: string,
    playDay: PlayDay,
  ): Promise<PenguinRun | null>;
  findAllInProgress(): Promise<PenguinRun[]>;
  save(run: PenguinRun): ResultAsync<void, DomainError>;
}
