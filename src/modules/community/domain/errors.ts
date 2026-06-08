/**
 * Stable, machine-readable failure codes for the Community module.
 */
export type DomainErrorCode =
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "INVALID_NAME"
  | "INVALID_SLUG"
  | "SLUG_ALREADY_EXISTS"
  | "OWNER_CANNOT_LEAVE"
  | "NOT_A_MEMBER"
  | "SAVE_FAILED";

export type DomainError = {
  readonly code: DomainErrorCode;
};

export function domainError(code: DomainErrorCode): DomainError {
  return { code };
}
