import { errAsync, ResultAsync } from "neverthrow";
import { type DomainError, domainError } from "../domain/errors";
import { Tournament } from "../domain/tournament";
import type { TournamentRepository } from "../domain/tournament-repository";

export type SetGroupResultCommand = {
  actorRole: string;
  group: string;
  orderedIds: string[];
};

export function setGroupResult(
  repo: TournamentRepository,
  command: SetGroupResultCommand,
): ResultAsync<void, DomainError> {
  // Authorization check
  if (command.actorRole !== "admin" && command.actorRole !== "super_admin") {
    return errAsync(domainError("FORBIDDEN"));
  }

  return ResultAsync.fromSafePromise(repo.get())
    .map((loaded) => loaded ?? Tournament.createDefault())
    .andThen((tournament) =>
      tournament.setGroupOrder(command.group, command.orderedIds),
    )
    .andThen((updated) => repo.save(updated));
}
