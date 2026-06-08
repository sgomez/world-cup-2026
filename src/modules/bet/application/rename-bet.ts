import { errAsync, okAsync, ResultAsync } from "neverthrow";
import type { BetRepository } from "../domain/bet-repository";
import type { BettingWindow } from "../domain/betting-window";
import { type DomainError, domainError } from "../domain/errors";

export type RenameBetCommand = {
  betId: string;
  userId: string;
  label: string;
  window: BettingWindow;
  now: Date;
};

export function renameBet(
  repo: BetRepository,
  command: RenameBetCommand,
): ResultAsync<void, DomainError> {
  return ResultAsync.fromSafePromise(repo.findById(command.betId))
    .andThen((bet) => (bet ? okAsync(bet) : errAsync(domainError("NOT_FOUND"))))
    .andThen((bet) =>
      bet.isOwnedBy(command.userId)
        ? okAsync(bet)
        : errAsync(domainError("FORBIDDEN")),
    )
    .andThen((bet) => bet.rename(command.label, command.window, command.now))
    .andThen((renamed) => repo.save(renamed));
}
