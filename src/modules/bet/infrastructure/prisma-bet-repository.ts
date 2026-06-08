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
            // `groupPredictions` is nullable in the aggregate, so we skip the
            // column when null. `knockoutWinners` is never null in aggregate
            // state (it rehydrates as `{}`), so it always writes a value.
            groupPredictions: state.groupPredictions ?? undefined,
            knockoutWinners: state.knockoutWinners,
          },
        })
        .then(() => undefined),
      // Only Prisma's "record to update not found" (P2025) means the aggregate
      // is gone; any other failure (connection drop, constraint, timeout) is a
      // persistence error, not a missing Bet.
      (error) =>
        isRecordNotFound(error)
          ? domainError("NOT_FOUND")
          : domainError("SAVE_FAILED"),
    );
  }

  delete(id: string): ResultAsync<void, DomainError> {
    return ResultAsync.fromPromise(
      this.client.bet.delete({ where: { id } }).then(() => undefined),
      // P2025 ("record to delete does not exist") means the Bet is already
      // gone; any other rejection is a persistence failure.
      (error) =>
        isRecordNotFound(error)
          ? domainError("NOT_FOUND")
          : domainError("SAVE_FAILED"),
    );
  }
}

/** Narrows an unknown rejection to Prisma's P2025 (record-to-update-not-found). */
function isRecordNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2025"
  );
}
