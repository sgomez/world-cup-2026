import { okAsync, type ResultAsync } from "neverthrow";
import type {
  ArcadeRankingFilter,
  ArcadeRankingRow,
  ArcadeRunRepository,
} from "../domain/arcade-run-repository";
import type { DomainError } from "../domain/errors";
import type { PenguinRun, PlayDay } from "../domain/penguin-run";

/**
 * In-memory adapter for `ArcadeRunRepository`. Used by application-service
 * integration tests so they run without a database (ADR 0008).
 */
export class InMemoryArcadeRunRepository implements ArcadeRunRepository {
  private readonly store = new Map<string, PenguinRun>();

  constructor(seed: PenguinRun[] = []) {
    for (const run of seed) {
      this.store.set(run.id, run);
    }
  }

  async findById(id: string): Promise<PenguinRun | null> {
    return this.store.get(id) ?? null;
  }

  async findByUserAndPlayDay(
    userId: string,
    playDay: PlayDay,
  ): Promise<PenguinRun | null> {
    for (const run of this.store.values()) {
      if (run.userId === userId && run.playDay === playDay) {
        return run;
      }
    }
    return null;
  }

  async findAllInProgress(): Promise<PenguinRun[]> {
    return [...this.store.values()].filter((r) => r.status === "in_progress");
  }

  async findRanking(filter?: ArcadeRankingFilter): Promise<ArcadeRankingRow[]> {
    // Collect the best score per user across finished/finalised runs in the period.
    const bestByUser = new Map<
      string,
      { bestScore: number; achievedAt: Date }
    >();

    for (const run of this.store.values()) {
      if (run.status === "in_progress") continue;
      if (run.bestScore === 0) continue;

      // Apply period filter
      if (filter) {
        if ("playDay" in filter) {
          if (run.playDay !== filter.playDay) continue;
        } else if ("startedAtRange" in filter) {
          const { gte, lte } = filter.startedAtRange;
          if (run.startedAt < gte || run.startedAt > lte) continue;
        }
      }

      const existing = bestByUser.get(run.userId);
      if (!existing || run.bestScore > existing.bestScore) {
        bestByUser.set(run.userId, {
          bestScore: run.bestScore,
          achievedAt: run.startedAt,
        });
      } else if (
        run.bestScore === existing.bestScore &&
        run.startedAt < existing.achievedAt
      ) {
        // Earlier run wins the tie-break.
        bestByUser.set(run.userId, {
          bestScore: run.bestScore,
          achievedAt: run.startedAt,
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
    this.store.set(run.id, run);
    return okAsync(undefined);
  }

  getData(): Map<string, PenguinRun> {
    return new Map(this.store);
  }

  setData(data: Map<string, PenguinRun>) {
    this.store.clear();
    for (const [k, v] of data) {
      this.store.set(k, v);
    }
  }
}
