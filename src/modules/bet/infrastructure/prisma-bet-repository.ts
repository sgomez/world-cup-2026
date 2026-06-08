import type { PrismaClient } from "@prisma/client";
import { ResultAsync } from "neverthrow";
import {
  Bet,
  type BetStatus,
  type GroupPredictions,
  type KnockoutWinners,
} from "../domain/bet";
import type { BetRepository } from "../domain/bet-repository";
import { type DomainError, domainError } from "../domain/errors";

/** The only `bet` operations this adapter needs (kept narrow for testability). */
type BetClient = Pick<PrismaClient, "bet">;

/**
 * Prisma adapter for the `BetRepository` port. This is the single place that
 * knows the ADR-0006 two-column `Json` storage shape and maps rows to and from
 * the Bet aggregate — the cast stops leaking into pages, actions, and the
 * signature module.
 */
export class PrismaBetRepository implements BetRepository {
  constructor(private readonly client: BetClient) {}

  async findById(id: string): Promise<Bet | null> {
    const row = await this.client.bet.findUnique({ where: { id } });
    if (!row) return null;

    return Bet.fromState({
      id: row.id,
      userId: row.userId,
      label: row.label,
      status: row.status as BetStatus,
      groupPredictions:
        (row.groupPredictions as GroupPredictions | null) ?? null,
      knockoutWinners: (row.knockoutWinners as KnockoutWinners | null) ?? {},
    });
  }

  save(bet: Bet): ResultAsync<void, DomainError> {
    const state = bet.toState();
    return ResultAsync.fromPromise(
      this.client.bet
        .update({
          where: { id: state.id },
          data: {
            label: state.label,
            status: state.status,
            groupPredictions: state.groupPredictions ?? undefined,
            knockoutWinners: state.knockoutWinners,
          },
        })
        .then(() => undefined),
      () => domainError("NOT_FOUND"),
    );
  }
}
