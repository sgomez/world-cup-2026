import { errAsync, ResultAsync } from "neverthrow";
import type { ArcadeRunRepository } from "../domain/arcade-run-repository";
import type { DomainError } from "../domain/errors";
import { domainError } from "../domain/errors";

export type FinishPenguinRunCommand = {
  runId: string;
  userId: string;
};

/**
 * `finishPenguinRun` use case.
 *
 * Finalises a PenguinRun as `finished` when the player explicitly ends (e.g.,
 * after all 3 Rounds or via an explicit finish action). Persists the best-of-three
 * score computed inside the aggregate.
 *
 * Rejects with `RUN_NOT_FOUND` if the run cannot be located.
 * Rejects with `RUN_NOT_IN_PROGRESS` if the run is already finished/finalised.
 */
export function finishPenguinRun(
  repo: ArcadeRunRepository,
  command: FinishPenguinRunCommand,
): ResultAsync<void, DomainError> {
  return ResultAsync.fromSafePromise(repo.findById(command.runId)).andThen(
    (run) => {
      if (!run) {
        return errAsync(domainError("RUN_NOT_FOUND"));
      }

      if (!run.isOwnedBy(command.userId)) {
        return errAsync(domainError("RUN_NOT_FOUND")); // do not leak existence
      }

      if (run.status !== "in_progress") {
        return errAsync(domainError("RUN_NOT_IN_PROGRESS"));
      }

      const finished = run.finish();
      return repo.save(finished).map(() => undefined);
    },
  );
}
