import { errAsync, okAsync, ResultAsync } from "neverthrow";
import type { ArcadeRunRepository } from "../domain/arcade-run-repository";
import type { DomainError } from "../domain/errors";
import { domainError } from "../domain/errors";
import { PenguinRun, toPlayDay } from "../domain/penguin-run";

export type StartPenguinRunCommand = {
  userId: string;
  /** Injected server clock — never trust client time. */
  clock: () => Date;
};

export type StartPenguinRunResult = {
  run: PenguinRun;
};

/**
 * `startPenguinRun` use case.
 *
 * Checks the daily limit for the current Play Day (UTC calendar day), creates
 * the run, stamps `startedAt` with the server clock, and persists it — consuming
 * the User's daily play immediately, whether or not the game is ever finished.
 *
 * Rejects with `ALREADY_PLAYED_TODAY` if a run (any status) already exists for
 * this User on the current Play Day.
 */
export function startPenguinRun(
  repo: ArcadeRunRepository,
  command: StartPenguinRunCommand,
): ResultAsync<StartPenguinRunResult, DomainError> {
  const now = command.clock();
  const playDay = toPlayDay(now);

  return ResultAsync.fromSafePromise(
    repo.findByUserAndPlayDay(command.userId, playDay),
  ).andThen((existing) => {
    if (existing !== null) {
      return errAsync(domainError("ALREADY_PLAYED_TODAY"));
    }

    const run = PenguinRun.create({ userId: command.userId, startedAt: now });

    return repo.save(run).map(() => ({ run }));
  });
}
