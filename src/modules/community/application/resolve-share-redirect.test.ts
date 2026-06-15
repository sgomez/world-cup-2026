import { describe, expect, it } from "vitest";
import { resolveShareRedirect } from "./resolve-share-redirect";

describe("resolveShareRedirect", () => {
  describe("logged-out user", () => {
    it("redirects to login with from param (default locale)", () => {
      const result = resolveShareRedirect({
        session: null,
        slug: "my-community",
      });
      expect(result).toBe("/login?from=/communities/my-community");
    });

    it("redirects to locale-prefixed login for non-default locale", () => {
      const result = resolveShareRedirect({
        session: null,
        slug: "mi-comunidad",
        locale: "es",
      });
      expect(result).toBe("/es/login?from=/communities/mi-comunidad");
    });

    it("uses the slug in the from param", () => {
      const result = resolveShareRedirect({
        session: null,
        slug: "peña-deportiva",
      });
      expect(result).toBe("/login?from=/communities/peña-deportiva");
    });
  });

  describe("authenticated user", () => {
    it("redirects directly to the community page (default locale)", () => {
      const result = resolveShareRedirect({
        session: { user: { id: "user-1" } },
        slug: "my-community",
      });
      expect(result).toBe("/communities/my-community");
    });

    it("redirects to locale-prefixed community page for non-default locale", () => {
      const result = resolveShareRedirect({
        session: { user: { id: "user-1" } },
        slug: "mi-comunidad",
        locale: "es",
      });
      expect(result).toBe("/es/communities/mi-comunidad");
    });

    it("uses the slug in the redirect target", () => {
      const result = resolveShareRedirect({
        session: { user: { id: "user-2" } },
        slug: "peña-deportiva",
      });
      expect(result).toBe("/communities/peña-deportiva");
    });
  });
});
