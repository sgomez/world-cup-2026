export type LiveDomainErrorCode =
  | "NOT_FOUND"
  | "INVALID_NUM"
  | "INVALID_GOALS"
  | "PENALTIES_NOT_ALLOWED"
  | "FINISHED_LATCH"
  | "SAVE_FAILED";

export type LiveDomainError = {
  readonly code: LiveDomainErrorCode;
};

export function liveDomainError(code: LiveDomainErrorCode): LiveDomainError {
  return { code };
}
