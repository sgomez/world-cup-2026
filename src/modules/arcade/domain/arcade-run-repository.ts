import type { ResultAsync } from "neverthrow";
import type { DomainError } from "./errors";
import type { PenguinRun, PlayDay } from "./penguin-run";

/**
 * Persistence port for the PenguinRun aggregate (ADR 0008).
 * Adapters live in `infrastructure/`.
 *
 * - `findActiveByUser` — returns the run that is `in_progress` for a user
 *   on the given Play Day, or `null` if none exists.
 * - `findByUserAndPlayDay` — returns any run (any status) for a user on the
 *   given Play Day. Used to enforce the daily limit.
 * - `save` — upserts the run by id.
 */
export interface ArcadeRunRepository {
  findByUserAndPlayDay(
    userId: string,
    playDay: PlayDay,
  ): Promise<PenguinRun | null>;
  save(run: PenguinRun): ResultAsync<void, DomainError>;
}
