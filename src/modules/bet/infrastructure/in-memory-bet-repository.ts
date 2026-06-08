import { okAsync, type ResultAsync } from "neverthrow";
import type { Bet } from "../domain/bet";
import type { BetRepository } from "../domain/bet-repository";
import type { DomainError } from "../domain/errors";

/**
 * In-memory adapter for the `BetRepository` port. Used by domain and
 * application tests so they run with no database (ADR 0008).
 */
export class InMemoryBetRepository implements BetRepository {
  private readonly store = new Map<string, Bet>();

  constructor(seed: Bet[] = []) {
    for (const bet of seed) {
      this.store.set(bet.id, bet);
    }
  }

  async findById(id: string): Promise<Bet | null> {
    return this.store.get(id) ?? null;
  }

  async listByOwner(userId: string): Promise<Bet[]> {
    return Array.from(this.store.values())
      .filter((bet) => bet.userId === userId)
      .sort((a, b) => {
        const aTime = a.createdAt?.getTime() ?? 0;
        const bTime = b.createdAt?.getTime() ?? 0;
        return bTime - aTime;
      });
  }

  async listByOwners(userIds: string[]): Promise<Bet[]> {
    return Array.from(this.store.values())
      .filter((bet) => userIds.includes(bet.userId))
      .sort((a, b) => {
        const aTime = a.createdAt?.getTime() ?? 0;
        const bTime = b.createdAt?.getTime() ?? 0;
        return bTime - aTime;
      });
  }

  async countByOwner(userId: string): Promise<number> {
    return Array.from(this.store.values()).filter(
      (bet) => bet.userId === userId,
    ).length;
  }

  save(bet: Bet): ResultAsync<void, DomainError> {
    this.store.set(bet.id, bet);
    return okAsync(undefined);
  }

  delete(id: string): ResultAsync<void, DomainError> {
    this.store.delete(id);
    return okAsync(undefined);
  }
}
