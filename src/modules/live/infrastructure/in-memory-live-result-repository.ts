import { okAsync, type ResultAsync } from "neverthrow";
import type { LiveDomainError } from "../domain/errors";
import type { LiveResult } from "../domain/live-result";
import type { LiveResultRepository } from "../domain/live-result-repository";

export class InMemoryLiveResultRepository implements LiveResultRepository {
  private store = new Map<number, LiveResult>();

  constructor(seed: LiveResult[] = []) {
    for (const lr of seed) {
      this.store.set(lr.num, lr);
    }
  }

  async findByNum(num: number): Promise<LiveResult | null> {
    return this.store.get(num) ?? null;
  }

  save(liveResult: LiveResult): ResultAsync<void, LiveDomainError> {
    this.store.set(liveResult.num, liveResult);
    return okAsync(undefined);
  }
}
