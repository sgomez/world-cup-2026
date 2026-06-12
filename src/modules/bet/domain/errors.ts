/**
 * Stable, machine-readable failure codes for the Bet module (ADR 0009).
 *
 * Codes — never human-facing strings — travel from the domain and application
 * layers out to the server action, which translates them via next-intl. Every
 * code added here needs a matching entry in `messages/en.json` and
 * `messages/es.json` under the `betErrors` namespace.
 */
export type DomainErrorCode =
  | "PAST_DEADLINE"
  | "INCOMPLETE_PREDICTIONS"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "SAVE_FAILED"
  | "INVALID_LABEL"
  | "LIMIT_EXCEEDED"
  | "INVALID_PREDICTIONS"
  | "BET_CLOSED";

export type DomainError = {
  readonly code: DomainErrorCode;
};

export function domainError(code: DomainErrorCode): DomainError {
  return { code };
}
