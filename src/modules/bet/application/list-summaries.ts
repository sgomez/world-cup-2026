import type { BetRepository } from "../domain/bet-repository";
import { type BetSummary, toSummary } from "./bet-summary";

export async function listSummaries(
  repo: BetRepository,
  ownerId: string,
): Promise<BetSummary[]> {
  const bets = await repo.listByOwner(ownerId);
  return bets.map(toSummary);
}
