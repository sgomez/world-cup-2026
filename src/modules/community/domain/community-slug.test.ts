import { describe, expect, it } from "vitest";
import { CommunitySlug } from "./community-slug";

describe("CommunitySlug Value Object", () => {
  describe("create", () => {
    it("creates a valid CommunitySlug from a valid slug string", () => {
      const result = CommunitySlug.create("valid-slug-123");
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().value).toBe("valid-slug-123");
    });

    it("fails for empty or whitespace slug", () => {
      const result = CommunitySlug.create("   ");
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe("INVALID_SLUG");
    });

    it("fails for invalid slug formats (e.g. spaces, uppercase, consecutive/leading/trailing hyphens)", () => {
      const invalidSlugs = [
        "Invalid-Slug",
        "invalid slug",
        "invalid--slug",
        "-invalid-slug",
        "invalid-slug-",
        "invalid@slug",
      ];
      for (const raw of invalidSlugs) {
        const result = CommunitySlug.create(raw);
        expect(result.isErr()).toBe(true);
        expect(result._unsafeUnwrapErr().code).toBe("INVALID_SLUG");
      }
    });

    it("fails for slugs longer than 200 characters", () => {
      const longSlug = "a".repeat(201);
      const result = CommunitySlug.create(longSlug);
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe("INVALID_SLUG");
    });
  });

  describe("derive", () => {
    it("derives a valid slug from a community name", () => {
      const result = CommunitySlug.derive("  My Awesome Community #1!  ");
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().value).toBe("my-awesome-community-1");
    });

    it("fails if derived slug would be empty", () => {
      const result = CommunitySlug.derive("!!! @@@ ###");
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe("INVALID_SLUG");
    });
  });
});
