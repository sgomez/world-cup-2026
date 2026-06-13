import { errAsync, okAsync, type ResultAsync } from "neverthrow";
import type { BetRepository } from "../domain/bet-repository";
import type { BettingWindow } from "../domain/betting-window";
import { type DomainError, domainError } from "../domain/errors";
import { loadOwnedBet } from "./mutate-owned-bet";

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
  return loadOwnedBet(repo, command)
    .andThen((bet) =>
      command.window.isOpen(command.now)
        ? okAsync(bet)
        : errAsync(domainError("PAST_DEADLINE")),
    )
    .andThen(() => repo.delete(command.betId));
}
