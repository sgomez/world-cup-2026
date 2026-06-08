import { errAsync, okAsync, ResultAsync } from "neverthrow";
import type { BetRepository } from "../domain/bet-repository";
import type { BettingWindow } from "../domain/betting-window";
import { type DomainError, domainError } from "../domain/errors";

export type ReopenBetCommand = {
  betId: string;
  userId: string;
  window: BettingWindow;
  now: Date;
};

/**
 * Application service for reopening a closed Bet to `draft`. Composes the
 * load -> ownership -> aggregate-method -> save pipeline as one `ResultAsync`
 * (ADR 0009), distinguishing a missing Bet (`NOT_FOUND`) from one the caller
 * does not own (`FORBIDDEN`). The Betting Window check lives inside
 * `bet.reopen`, so the deadline cannot be skipped here.
 */
export function reopenBet(
  repo: BetRepository,
  command: ReopenBetCommand,
): ResultAsync<void, DomainError> {
  return ResultAsync.fromSafePromise(repo.findById(command.betId))
    .andThen((bet) => (bet ? okAsync(bet) : errAsync(domainError("NOT_FOUND"))))
    .andThen((bet) =>
      bet.isOwnedBy(command.userId)
        ? okAsync(bet)
        : errAsync(domainError("FORBIDDEN")),
    )
    .andThen((bet) => bet.reopen(command.window, command.now))
    .andThen((reopened) => repo.save(reopened));
}
