import { errAsync, okAsync, ResultAsync } from "neverthrow";
import type { GroupPredictions, KnockoutWinners } from "../domain/bet";
import type { BetRepository } from "../domain/bet-repository";
import type { BettingWindow } from "../domain/betting-window";
import { type DomainError, domainError } from "../domain/errors";

export type UpdateBetPredictionsCommand = {
  betId: string;
  userId: string;
  window: BettingWindow;
  now: Date;
  groupPredictions: GroupPredictions | null;
  knockoutWinners: KnockoutWinners;
};

export function updateBetPredictions(
  repo: BetRepository,
  command: UpdateBetPredictionsCommand,
): ResultAsync<void, DomainError> {
  return ResultAsync.fromSafePromise(repo.findById(command.betId))
    .andThen((bet) => (bet ? okAsync(bet) : errAsync(domainError("NOT_FOUND"))))
    .andThen((bet) =>
      bet.isOwnedBy(command.userId)
        ? okAsync(bet)
        : errAsync(domainError("FORBIDDEN")),
    )
    .andThen((bet) =>
      bet.updatePredictions(
        command.groupPredictions,
        command.knockoutWinners,
        command.window,
        command.now,
      ),
    )
    .andThen((updated) => repo.save(updated));
}
