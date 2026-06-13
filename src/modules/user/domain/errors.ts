/**
 * Stable, machine-readable failure codes for the User module.
 */
export type DomainErrorCode =
  | "NAME_REQUIRED"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "SAVE_FAILED"
  | "SELF_DEMOTION_NOT_ALLOWED"
  | "SUPER_ADMIN_IMMUTABLE";

export type DomainError = {
  readonly code: DomainErrorCode;
};

export function domainError(code: DomainErrorCode): DomainError {
  return { code };
}
