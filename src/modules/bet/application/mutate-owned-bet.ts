import type { Result } from "neverthrow";
import { errAsync, okAsync, ResultAsync } from "neverthrow";
import type { Bet } from "../domain/bet";
import type { BetRepository } from "../domain/bet-repository";
import { type DomainError, domainError } from "../domain/errors";

export function loadOwnedBet(
  repo: BetRepository,
  command: { betId: string; userId: string },
): ResultAsync<Bet, DomainError> {
  return ResultAsync.fromSafePromise(repo.findById(command.betId))
    .andThen((bet) => (bet ? okAsync(bet) : errAsync(domainError("NOT_FOUND"))))
    .andThen((bet) =>
      bet.isOwnedBy(command.userId)
        ? okAsync(bet)
        : errAsync(domainError("FORBIDDEN")),
    );
}

export function mutateOwnedBet(
  repo: BetRepository,
  command: { betId: string; userId: string },
  action: (
    bet: Bet,
  ) => ResultAsync<Bet, DomainError> | Result<Bet, DomainError>,
): ResultAsync<void, DomainError> {
  return loadOwnedBet(repo, command)
    .andThen(action)
    .andThen((mutatedBet) => repo.save(mutatedBet));
}
