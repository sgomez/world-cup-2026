import { err, ok, type Result } from "neverthrow";
import { type DomainError, domainError } from "./errors";

export class CommunityName {
  private constructor(readonly value: string) {}

  static create(raw: string): Result<CommunityName, DomainError> {
    const trimmed = raw.trim();
    if (!trimmed) {
      return err(domainError("INVALID_NAME"));
    }
    if (trimmed.length > 200) {
      return err(domainError("INVALID_NAME"));
    }
    // Must contain at least one letter or digit
    const hasAlphanumeric = /[a-zA-Z0-9]/.test(trimmed);
    if (!hasAlphanumeric) {
      return err(domainError("INVALID_NAME"));
    }
    return ok(new CommunityName(trimmed));
  }
}
