import type { ResultAsync } from "neverthrow";
import type { LiveDomainError } from "./errors";
import type { LiveResult } from "./live-result";

export interface LiveResultRepository {
  findByNum(num: number): Promise<LiveResult | null>;
  findAll(): Promise<LiveResult[]>;
  save(liveResult: LiveResult): ResultAsync<void, LiveDomainError>;
}
