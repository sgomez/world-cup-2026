import type { PrismaClient } from "@prisma/client";
import { ResultAsync } from "neverthrow";
import type {
  ArcadeRankingRow,
  ArcadeRunRepository,
} from "../domain/arcade-run-repository";
import type { DomainError } from "../domain/errors";
import { domainError } from "../domain/errors";
import {
  PenguinRun,
  type PenguinRunState,
  type PenguinRunStatus,
  type PlayDay,
  type RoundRecord,
} from "../domain/penguin-run";

/** The only `penguinRun` operations this adapter needs (narrow for testability). */
type PenguinRunClient = Pick<PrismaClient, "penguinRun">;

type PenguinRunRow = {
  id: string;
  userId: string;
  playDay: string;
  startedAt: Date;
  lastSeenAt: Date;
  status: string;
  bestScore: number;
  rounds: RoundRecord[];
};

function rowToState(row: PenguinRunRow): PenguinRunState {
  return {
    id: row.id,
    userId: row.userId,
    playDay: row.playDay,
    startedAt: row.startedAt,
    lastSeenAt: row.lastSeenAt,
    status: row.status as PenguinRunStatus,
    bestScore: row.bestScore,
    rounds: (row.rounds ?? []) as RoundRecord[],
  };
}

/**
 * Prisma adapter for the `ArcadeRunRepository` port.
 * Maps database rows to and from the PenguinRun aggregate.
 */
export class PrismaArcadeRunRepository implements ArcadeRunRepository {
  constructor(private readonly client: PenguinRunClient) {}

  async findById(id: string): Promise<PenguinRun | null> {
    const row = await this.client.penguinRun.findUnique({ where: { id } });
    if (!row) return null;
    return PenguinRun.fromState(rowToState(row as unknown as PenguinRunRow));
  }

  async findByUserAndPlayDay(
    userId: string,
    playDay: PlayDay,
  ): Promise<PenguinRun | null> {
    const row = await this.client.penguinRun.findUnique({
      where: { userId_playDay: { userId, playDay } },
    });
    if (!row) return null;

    return PenguinRun.fromState(rowToState(row as unknown as PenguinRunRow));
  }

  async findAllInProgress(): Promise<PenguinRun[]> {
    const rows = await this.client.penguinRun.findMany({
      where: { status: "in_progress" },
    });
    return rows.map((row: unknown) =>
      PenguinRun.fromState(rowToState(row as unknown as PenguinRunRow)),
    );
  }

  async findAllTimeRanking(): Promise<ArcadeRankingRow[]> {
    // Fetch all non-in_progress runs with a positive score,
    // then compute per-user best in application code.
    const rows = await this.client.penguinRun.findMany({
      where: {
        status: { in: ["finished", "finalised"] },
        bestScore: { gt: 0 },
      },
      select: {
        userId: true,
        bestScore: true,
        startedAt: true,
      },
    });

    const bestByUser = new Map<
      string,
      { bestScore: number; achievedAt: Date }
    >();

    for (const row of rows as Array<{
      userId: string;
      bestScore: number;
      startedAt: Date;
    }>) {
      const existing = bestByUser.get(row.userId);
      if (!existing || row.bestScore > existing.bestScore) {
        bestByUser.set(row.userId, {
          bestScore: row.bestScore,
          achievedAt: row.startedAt,
        });
      } else if (
        row.bestScore === existing.bestScore &&
        row.startedAt < existing.achievedAt
      ) {
        bestByUser.set(row.userId, {
          bestScore: row.bestScore,
          achievedAt: row.startedAt,
        });
      }
    }

    return [...bestByUser.entries()].map(
      ([userId, { bestScore, achievedAt }]) => ({
        userId,
        bestScore,
        achievedAt,
      }),
    );
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
            rounds: state.rounds,
          },
          update: {
            lastSeenAt: state.lastSeenAt,
            status: state.status,
            bestScore: state.bestScore,
            rounds: state.rounds,
          },
        })
        .then(() => undefined),
      () => domainError("SAVE_FAILED"),
    );
  }
}
