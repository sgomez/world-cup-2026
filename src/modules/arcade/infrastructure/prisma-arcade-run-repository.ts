import type { PrismaClient } from "@prisma/client";
import { ResultAsync } from "neverthrow";
import type { ArcadeRunRepository } from "../domain/arcade-run-repository";
import type { DomainError } from "../domain/errors";
import { domainError } from "../domain/errors";
import {
  PenguinRun,
  type PenguinRunStatus,
  type PlayDay,
} from "../domain/penguin-run";

/** The only `penguinRun` operations this adapter needs (narrow for testability). */
type PenguinRunClient = Pick<PrismaClient, "penguinRun">;

/**
 * Prisma adapter for the `ArcadeRunRepository` port.
 * Maps database rows to and from the PenguinRun aggregate.
 */
export class PrismaArcadeRunRepository implements ArcadeRunRepository {
  constructor(private readonly client: PenguinRunClient) {}

  async findByUserAndPlayDay(
    userId: string,
    playDay: PlayDay,
  ): Promise<PenguinRun | null> {
    const row = await this.client.penguinRun.findUnique({
      where: { userId_playDay: { userId, playDay } },
    });
    if (!row) return null;

    return PenguinRun.fromState({
      id: row.id,
      userId: row.userId,
      playDay: row.playDay,
      startedAt: row.startedAt,
      lastSeenAt: row.lastSeenAt,
      status: row.status as PenguinRunStatus,
      bestScore: row.bestScore,
    });
  }

  save(run: PenguinRun): ResultAsync<void, DomainError> {
    const state = run.toState();
    return ResultAsync.fromPromise(
      this.client.penguinRun
        .upsert({
          where: {
            userId_playDay: { userId: state.userId, playDay: state.playDay },
          },
          create: {
            id: state.id,
            userId: state.userId,
            playDay: state.playDay,
            startedAt: state.startedAt,
            lastSeenAt: state.lastSeenAt,
            status: state.status,
            bestScore: state.bestScore,
          },
          update: {
            lastSeenAt: state.lastSeenAt,
            status: state.status,
            bestScore: state.bestScore,
          },
        })
        .then(() => undefined),
      () => domainError("SAVE_FAILED"),
    );
  }
}
