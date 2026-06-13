import type { ResultAsync } from "neverthrow";
import type { BetRepository } from "../domain/bet-repository";
import type { BettingWindow } from "../domain/betting-window";
import type { DomainError } from "../domain/errors";
import { mutateOwnedBet } from "./mutate-owned-bet";

export type CloseBetCommand = {
  betId: string;
  userId: string;
  window: BettingWindow;
  now: Date;
};

/**
 * Application service for closing a Bet. Composes the load -> ownership ->
 * aggregate-method -> save pipeline as one `ResultAsync` (ADR 0009).
 *
 * Ownership is checked here (an application concern, ADR 0008), distinguishing
 * a missing Bet (`NOT_FOUND`) from one the caller does not own (`FORBIDDEN`).
 */
export function closeBet(
  repo: BetRepository,
  command: CloseBetCommand,
): ResultAsync<void, DomainError> {
  return mutateOwnedBet(repo, command, (bet) =>
    bet.close(command.window, command.now),
  );
}
