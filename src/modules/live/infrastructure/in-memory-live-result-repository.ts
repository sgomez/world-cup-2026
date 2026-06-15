import { errAsync, okAsync, type ResultAsync } from "neverthrow";
import { type LiveDomainError, liveDomainError } from "../domain/errors";
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

  async findAll(): Promise<LiveResult[]> {
    return Array.from(this.store.values());
  }

  save(liveResult: LiveResult): ResultAsync<void, LiveDomainError> {
    this.store.set(liveResult.num, liveResult);
    return okAsync(undefined);
  }

  saveLink(num: number, link: string): ResultAsync<void, LiveDomainError> {
    const existing = this.store.get(num);
    if (!existing) return errAsync(liveDomainError("SAVE_FAILED"));
    this.store.set(num, existing.withLink(link));
    return okAsync(undefined);
  }

  getData(): Map<number, LiveResult> {
    return new Map(this.store);
  }

  setData(data: Map<number, LiveResult>) {
    this.store.clear();
    for (const [k, v] of data) {
      this.store.set(k, v);
    }
  }
}
