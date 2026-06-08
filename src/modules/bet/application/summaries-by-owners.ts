import type { BetRepository } from "../domain/bet-repository";
import { type BetSummary, toSummary } from "./bet-summary";

export async function summariesByOwners(
  repo: BetRepository,
  ownerIds: string[],
): Promise<Map<string, BetSummary[]>> {
  if (ownerIds.length === 0) return new Map();

  const bets = await repo.listByOwners(ownerIds);

  const result = new Map<string, BetSummary[]>();
  for (const bet of bets) {
    const list = result.get(bet.userId) ?? [];
    list.push(toSummary(bet));
    result.set(bet.userId, list);
  }
  return result;
}
