export type DomainErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_ORDER"
  | "INVALID_REF"
  | "SAVE_FAILED"
  | "PARTICIPANTS_NOT_ADVANCED"
  | "INVALID_MATCH";

export type DomainError = {
  readonly code: DomainErrorCode;
};

export function domainError(code: DomainErrorCode): DomainError {
  return { code };
}
