import { errAsync, ResultAsync } from "neverthrow";
import { type DomainError, domainError } from "../domain/errors";
import { Tournament } from "../domain/tournament";
import type { TournamentRepository } from "../domain/tournament-repository";

export type UnmarkAdvancedCommand = {
  actorRole: string;
  ref: string;
};

export function unmarkAdvanced(
  repo: TournamentRepository,
  command: UnmarkAdvancedCommand,
): ResultAsync<void, DomainError> {
  // Authorization check
  if (command.actorRole !== "admin" && command.actorRole !== "super_admin") {
    return errAsync(domainError("FORBIDDEN"));
  }

  return ResultAsync.fromSafePromise(repo.get())
    .map((loaded) => loaded ?? Tournament.createDefault())
    .andThen((tournament) => tournament.unmarkAdvanced(command.ref))
    .andThen((updated) => repo.save(updated));
}
