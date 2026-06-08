import type { BetRepository } from "../domain/bet-repository";
import type { BettingWindow } from "../domain/betting-window";
import { type BetSummary, toSummary } from "./bet-summary";

export async function peerSummariesByOwners(
  repo: BetRepository,
  ownerIds: string[],
  window: BettingWindow,
  now: Date,
): Promise<Map<string, BetSummary[]>> {
  if (ownerIds.length === 0) return new Map();

  const bets = await repo.listByOwners(ownerIds);

  const result = new Map<string, BetSummary[]>();
  for (const bet of bets) {
    const visibility = bet.peerVisibility(window, now);
    if (visibility === "hidden") {
      continue;
    }
    const list = result.get(bet.userId) ?? [];
    list.push(toSummary(bet));
    result.set(bet.userId, list);
  }
  return result;
}
