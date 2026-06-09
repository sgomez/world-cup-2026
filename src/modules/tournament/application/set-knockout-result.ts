import { errAsync, ResultAsync } from "neverthrow";
import { type DomainError, domainError } from "../domain/errors";
import { Tournament } from "../domain/tournament";
import type { TournamentRepository } from "../domain/tournament-repository";

export type SetKnockoutResultCommand = {
  actorRole: string;
  matchId: string;
  winnerId: string;
};

export function setKnockoutResult(
  repo: TournamentRepository,
  command: SetKnockoutResultCommand,
): ResultAsync<void, DomainError> {
  // Authorization check
  if (command.actorRole !== "admin" && command.actorRole !== "super_admin") {
    return errAsync(domainError("FORBIDDEN"));
  }

  return ResultAsync.fromSafePromise(repo.get())
    .map((loaded) => loaded ?? Tournament.createDefault())
    .andThen((tournament) =>
      tournament.setKnockoutWinner(command.matchId, command.winnerId),
    )
    .andThen((updated) => repo.save(updated));
}
