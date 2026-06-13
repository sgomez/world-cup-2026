import type { ResultAsync } from "neverthrow";
import type { BetRepository } from "../domain/bet-repository";
import type { BettingWindow } from "../domain/betting-window";
import type { DomainError } from "../domain/errors";
import { mutateOwnedBet } from "./mutate-owned-bet";

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
  return mutateOwnedBet(repo, command, (bet) =>
    bet.rename(command.label, command.window, command.now),
  );
}
