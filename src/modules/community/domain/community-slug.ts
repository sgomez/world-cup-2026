import { err, ok, type Result } from "neverthrow";
import { type DomainError, domainError } from "./errors";

export class CommunitySlug {
  private constructor(readonly value: string) {}

  static create(raw: string): Result<CommunitySlug, DomainError> {
    const trimmed = raw.trim();
    if (!trimmed) {
      return err(domainError("INVALID_SLUG"));
    }
    if (trimmed.length > 200) {
      return err(domainError("INVALID_SLUG"));
    }
    const regex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    if (!regex.test(trimmed)) {
      return err(domainError("INVALID_SLUG"));
    }
    return ok(new CommunitySlug(trimmed));
  }

  static derive(name: string): Result<CommunitySlug, DomainError> {
    const derived = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (!derived) {
      return err(domainError("INVALID_SLUG"));
    }
    return ok(new CommunitySlug(derived));
  }
}
