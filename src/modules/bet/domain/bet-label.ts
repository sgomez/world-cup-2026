import { err, ok, type Result } from "neverthrow";
import { type DomainError, domainError } from "./errors";

export class BetLabel {
  private constructor(readonly value: string) {}

  static create(raw: string): Result<BetLabel, DomainError> {
    const trimmed = raw?.trim() ?? "";
    if (!trimmed) return err(domainError("INVALID_LABEL"));
    if (trimmed.length > 200) return err(domainError("INVALID_LABEL"));
    return ok(new BetLabel(trimmed));
  }
}
