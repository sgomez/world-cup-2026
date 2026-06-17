import { errAsync, ResultAsync } from "neverthrow";
import type { ArcadeRunRepository } from "../domain/arcade-run-repository";
import type { DomainError } from "../domain/errors";
import { domainError } from "../domain/errors";

export type RecordHeartbeatCommand = {
  runId: string;
  userId: string;
  /** Injected server clock — never trust client time. */
  clock: () => Date;
};

/**
 * `recordHeartbeat` use case.
 *
 * Updates `lastSeenAt` on an active (in_progress) PenguinRun to prove it is
 * still live. The server clock is authoritative; client-supplied time is not
 * accepted. If the heartbeat lapses beyond tolerance the run is finalised
 * lazily on `getArcadeRanking` read (ADR 0034).
 *
 * Rejects with `RUN_NOT_FOUND` if the run cannot be located.
 * Rejects with `RUN_NOT_IN_PROGRESS` if the run is already finished/finalised.
 */
export function recordHeartbeat(
  repo: ArcadeRunRepository,
  command: RecordHeartbeatCommand,
): ResultAsync<void, DomainError> {
  const now = command.clock();

  return ResultAsync.fromSafePromise(repo.findById(command.runId)).andThen(
    (run) => {
      if (!run) {
        return errAsync(domainError("RUN_NOT_FOUND"));
      }

      if (!run.isOwnedBy(command.userId)) {
        return errAsync(domainError("RUN_NOT_FOUND")); // do not leak existence
      }

      const updated = run.recordHeartbeat(now);
      if ("code" in updated) {
        return errAsync(updated);
      }

      return repo.save(updated).map(() => undefined);
    },
  );
}
