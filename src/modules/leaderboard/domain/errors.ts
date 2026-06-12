/**
 * Stable, machine-readable failure codes for the Leaderboard module.
 */
export type DomainErrorCode = "NOT_FOUND" | "FORBIDDEN";

export type DomainError = {
  readonly code: DomainErrorCode;
};

export function domainError(code: DomainErrorCode): DomainError {
  return { code };
}
