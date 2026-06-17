import { okAsync, type ResultAsync } from "neverthrow";
import type { ArcadeRunRepository } from "../domain/arcade-run-repository";
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
