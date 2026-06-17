/**
 * Stable, machine-readable failure codes for the Arcade module (ADR 0009).
 *
 * Codes travel from the domain and application layers out to the API route,
 * which translates them via next-intl. Every code added here needs a matching
 * entry in `messages/en.json` and `messages/es.json` under the `arcadeErrors`
 * namespace.
 */
export type DomainErrorCode =
  | "ALREADY_PLAYED_TODAY"
  | "RUN_NOT_FOUND"
  | "SAVE_FAILED"
  | "FORBIDDEN";

export type DomainError = {
  readonly code: DomainErrorCode;
};

export function domainError(code: DomainErrorCode): DomainError {
  return { code };
}
