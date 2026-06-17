import { errAsync, ResultAsync } from "neverthrow";
import type { ArcadeRunRepository } from "../domain/arcade-run-repository";
import type { DomainError } from "../domain/errors";
import { domainError } from "../domain/errors";
import type { PenguinRun } from "../domain/penguin-run";

export type RecordRoundCommand = {
  runId: string;
  userId: string;
  /** Client-supplied start of this Round. The server clamps it to no earlier
   *  than `run.startedAt` to prevent artificially widening the score ceiling. */
  roundStartedAt: Date;
  /** The score the client reports for this Round. Capped by the server-derived
   *  ceiling (ADR 0034). */
  reportedScore: number;
  /** Injected server clock — stamps roundEndedAt, never the client's time. */
  clock: () => Date;
};

export type RecordRoundResult = {
  run: PenguinRun;
};

/**
 * `recordRound` use case.
 *
 * Called at each life/Round boundary. The server stamps the Round end with
 * its own clock and enforces the score ceiling derived from elapsed time
 * (ADR 0034). Client-reported timestamps are never trusted for scoring.
 *
 * After three Rounds the run transitions to `finished` automatically inside
 * the aggregate.
 *
 * Rejects with `RUN_NOT_FOUND` if the run cannot be located.
 * Rejects with `RUN_NOT_IN_PROGRESS` if the run is already finished/finalised.
 */
export function recordRound(
  repo: ArcadeRunRepository,
  command: RecordRoundCommand,
): ResultAsync<RecordRoundResult, DomainError> {
  const now = command.clock();

  return ResultAsync.fromSafePromise(repo.findById(command.runId)).andThen(
    (run) => {
      if (!run) {
        return errAsync(domainError("RUN_NOT_FOUND"));
      }

      if (!run.isOwnedBy(command.userId)) {
        return errAsync(domainError("RUN_NOT_FOUND")); // do not leak existence
      }

      // Clamp client-supplied roundStartedAt: prevent an artificially early
      // timestamp from widening the elapsed-seconds window (and thus the ceiling).
      const clampedStart = new Date(
        Math.max(command.roundStartedAt.getTime(), run.startedAt.getTime()),
      );

      const updated = run.recordRound({
        roundStartedAt: clampedStart,
        roundEndedAt: now,
        reportedScore: command.reportedScore,
      });

      if ("code" in updated) {
        return errAsync(updated);
      }

      return repo.save(updated).map(() => ({ run: updated }));
    },
  );
}
