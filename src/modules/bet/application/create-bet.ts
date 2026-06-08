import { errAsync, okAsync, ResultAsync } from "neverthrow";
import { Bet } from "../domain/bet";
import type { BetRepository } from "../domain/bet-repository";
import type { BettingWindow } from "../domain/betting-window";
import { type DomainError, domainError } from "../domain/errors";

export type CreateBetCommand = {
  userId: string;
  label: string;
  limit: number;
  window: BettingWindow;
  now: Date;
};

export function createBet(
  repo: BetRepository,
  command: CreateBetCommand,
): ResultAsync<Bet, DomainError> {
  if (!command.window.isOpen(command.now)) {
    return errAsync<Bet, DomainError>(domainError("PAST_DEADLINE"));
  }
  return ResultAsync.fromSafePromise(repo.countByOwner(command.userId))
    .andThen((count) => {
      if (count >= command.limit) {
        return errAsync<Bet, DomainError>(domainError("LIMIT_EXCEEDED"));
      }
      const betResult = Bet.create(
        command.label,
        command.userId,
        command.window,
        command.now,
      );
      if (betResult.isErr()) {
        return errAsync<Bet, DomainError>(betResult.error);
      }
      return okAsync<Bet, DomainError>(betResult.value);
    })
    .andThen((bet) => repo.save(bet).map(() => bet));
}
