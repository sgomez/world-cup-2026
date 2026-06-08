import { errAsync, okAsync, ResultAsync } from "neverthrow";
import type { BetRepository } from "../domain/bet-repository";
import type { BettingWindow } from "../domain/betting-window";
import { type DomainError, domainError } from "../domain/errors";

export type RemoveBetCommand = {
  betId: string;
  userId: string;
  window: BettingWindow;
  now: Date;
};

/**
 * Application service for removing a Bet. Composes load -> ownership ->
 * Betting Window -> delete as one `ResultAsync` (ADR 0009), distinguishing a
 * missing Bet (`NOT_FOUND`) from one the caller does not own (`FORBIDDEN`).
 *
 * Removal is not a state transition on the aggregate (the Bet ceases to exist),
 * so the Betting Window is enforced here: a Bet may be removed in any status,
 * but only before the Bet Deadline.
 */
export function removeBet(
  repo: BetRepository,
  command: RemoveBetCommand,
): ResultAsync<void, DomainError> {
  return ResultAsync.fromSafePromise(repo.findById(command.betId))
    .andThen((bet) => (bet ? okAsync(bet) : errAsync(domainError("NOT_FOUND"))))
    .andThen((bet) =>
      bet.isOwnedBy(command.userId)
        ? okAsync(bet)
        : errAsync(domainError("FORBIDDEN")),
    )
    .andThen((bet) =>
      command.window.isOpen(command.now)
        ? okAsync(bet)
        : errAsync(domainError("PAST_DEADLINE")),
    )
    .andThen(() => repo.delete(command.betId));
}
