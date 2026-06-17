import { errAsync, ResultAsync } from "neverthrow";
import type { ArcadeRunRepository } from "../domain/arcade-run-repository";
import type { DomainError } from "../domain/errors";
import { domainError } from "../domain/errors";
import type { PenguinRun } from "../domain/penguin-run";

export type RecordRoundCommand = {
  runId: string;
  userId: string;
  /** Server-stamped start of this Round. The client may send this but the
   *  server validates it against the run's startedAt. */
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

      const updated = run.recordRound({
        roundStartedAt: command.roundStartedAt,
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
