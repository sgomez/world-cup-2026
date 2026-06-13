import type { PrismaClient } from "@prisma/client";
import { ResultAsync } from "neverthrow";
import type { ScoreableContentArrays } from "@/modules/score";
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
      directPredictions:
        (row.directPredictions as ScoreableContentArrays | null) ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  async listByOwner(userId: string): Promise<Bet[]> {
    const rows = await this.client.bet.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) =>
      Bet.fromState({
        id: row.id,
        userId: row.userId,
        label: row.label,
        status: row.status as BetStatus,
        groupPredictions:
          (row.groupPredictions as GroupPredictions | null) ?? null,
        knockoutWinners: (row.knockoutWinners as KnockoutWinners | null) ?? {},
        directPredictions:
          (row.directPredictions as ScoreableContentArrays | null) ?? null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }),
    );
  }

  async listByOwners(userIds: string[]): Promise<Bet[]> {
    const rows = await this.client.bet.findMany({
      where: { userId: { in: userIds } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) =>
      Bet.fromState({
        id: row.id,
        userId: row.userId,
        label: row.label,
        status: row.status as BetStatus,
        groupPredictions:
          (row.groupPredictions as GroupPredictions | null) ?? null,
        knockoutWinners: (row.knockoutWinners as KnockoutWinners | null) ?? {},
        directPredictions:
          (row.directPredictions as ScoreableContentArrays | null) ?? null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }),
    );
  }

  async countByOwner(userId: string): Promise<number> {
    return this.client.bet.count({
      where: { userId },
    });
  }

  save(bet: Bet): ResultAsync<void, DomainError> {
    const state = bet.toState();
    return ResultAsync.fromPromise(
      this.client.bet
        .upsert({
          where: { id: state.id },
          create: {
            id: state.id,
            userId: state.userId,
            label: state.label,
            status: state.status,
            groupPredictions: state.groupPredictions ?? undefined,
            knockoutWinners: state.knockoutWinners,
            // biome-ignore lint/suspicious/noExplicitAny: Prisma JSON input type check mismatch
            directPredictions: (state.directPredictions ?? undefined) as any,
          },
          update: {
            label: state.label,
            status: state.status,
            groupPredictions: state.groupPredictions ?? undefined,
            knockoutWinners: state.knockoutWinners,
            // biome-ignore lint/suspicious/noExplicitAny: Prisma JSON input type check mismatch
            directPredictions: (state.directPredictions ?? undefined) as any,
          },
        })
        .then(() => undefined),
      () => domainError("SAVE_FAILED"),
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

/** Narrows an unknown rejection to Prisma's P2025 (record not found). */
function isRecordNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2025"
  );
}
