import { errAsync, okAsync, ResultAsync } from "neverthrow";
import { Bet } from "../domain/bet";
import type { BetRepository } from "../domain/bet-repository";
import type { BettingWindow } from "../domain/betting-window";
import { type DomainError, domainError } from "../domain/errors";

export type CopyBetCommand = {
  betId: string;
  userId: string;
  limit: number;
  window: BettingWindow;
  now: Date;
};

export function copyBet(
  repo: BetRepository,
  command: CopyBetCommand,
): ResultAsync<Bet, DomainError> {
  return ResultAsync.fromSafePromise(repo.findById(command.betId))
    .andThen((bet) => (bet ? okAsync(bet) : errAsync(domainError("NOT_FOUND"))))
    .andThen((bet) =>
      bet.isOwnedBy(command.userId)
        ? okAsync(bet)
        : errAsync(domainError("FORBIDDEN")),
    )
    .andThen((sourceBet) => {
      if (!command.window.isOpen(command.now)) {
        return errAsync<Bet, DomainError>(domainError("PAST_DEADLINE"));
      }
      return ResultAsync.fromSafePromise(
        repo.countByOwner(command.userId),
      ).andThen((count) => {
        if (count >= command.limit) {
          return errAsync<Bet, DomainError>(domainError("LIMIT_EXCEEDED"));
        }
        const copyResult = Bet.copyFrom(
          sourceBet,
          command.userId,
          command.window,
          command.now,
        );
        if (copyResult.isErr()) {
          return errAsync<Bet, DomainError>(copyResult.error);
        }
        return okAsync<Bet, DomainError>(copyResult.value);
      });
    })
    .andThen((newBet) => repo.save(newBet).map(() => newBet));
}
