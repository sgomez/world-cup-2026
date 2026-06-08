import type { ResultAsync } from "neverthrow";
import type { Bet } from "./bet";
import type { DomainError } from "./errors";

/**
 * Persistence port for the Bet aggregate (ADR 0008). Adapters live in
 * `infrastructure/`. This tracer slice needs only the operations `closeBet`
 * uses; later slices widen the port (`listByOwner`, `countByOwner`, `delete`).
 *
 * `findById` models absence as a plain `null` (not an error); the application
 * service converts `null` into `NOT_FOUND`. Writes return `ResultAsync`
 * (ADR 0009). Later slices widen the port further (`listByOwner`,
 * `countByOwner`).
 */
export interface BetRepository {
  findById(id: string): Promise<Bet | null>;
  save(bet: Bet): ResultAsync<void, DomainError>;
  delete(id: string): ResultAsync<void, DomainError>;
}
