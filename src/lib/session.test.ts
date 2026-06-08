import { getLocale } from "next-intl/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "@/i18n/navigation";
import { auth, type Session } from "./auth";
import { requireAdmin, requireSession } from "./session";

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock("next-intl/server", () => ({
  getLocale: vi.fn().mockResolvedValue("en"),
}));

vi.mock("@/i18n/navigation", () => ({
  redirect: vi
    .fn()
    .mockImplementation((args: { href: string; locale: string }) => {
      throw new Error(`Redirect to ${args.href} (${args.locale})`);
    }),
}));

vi.mock("./auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

const mockGetSession = vi.mocked(auth.api.getSession);
const mockGetLocale = vi.mocked(getLocale);
const mockRedirect = vi.mocked(redirect);

describe("session guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("requireSession", () => {
    it("redirects to /login in current locale if no session exists", async () => {
      mockGetSession.mockResolvedValue(null);
      mockGetLocale.mockResolvedValue("es");

      await expect(requireSession()).rejects.toThrow("Redirect to /login (es)");
      expect(mockRedirect).toHaveBeenCalledWith({
        href: "/login",
        locale: "es",
      });
    });

    it("returns session if it exists", async () => {
      const mockSessionVal = {
        user: { id: "user-1", role: "user" },
        session: { id: "session-1" },
      } as unknown as Session;
      mockGetSession.mockResolvedValue(mockSessionVal);

      const result = await requireSession();
      expect(result).toEqual(mockSessionVal);
      expect(mockRedirect).not.toHaveBeenCalled();
    });
  });

  describe("requireAdmin", () => {
    it("redirects to /login if no session exists", async () => {
      mockGetSession.mockResolvedValue(null);
      mockGetLocale.mockResolvedValue("en");

      await expect(requireAdmin()).rejects.toThrow("Redirect to /login (en)");
    });

    it("redirects to / if user is not admin or super_admin", async () => {
      const mockSessionVal = {
        user: { id: "user-1", role: "user" },
        session: { id: "session-1" },
      } as unknown as Session;
      mockGetSession.mockResolvedValue(mockSessionVal);
      mockGetLocale.mockResolvedValue("es");

      await expect(requireAdmin()).rejects.toThrow("Redirect to / (es)");
      expect(mockRedirect).toHaveBeenCalledWith({ href: "/", locale: "es" });
    });

    it("returns session if user is admin", async () => {
      const mockSessionVal = {
        user: { id: "user-1", role: "admin" },
        session: { id: "session-1" },
      } as unknown as Session;
      mockGetSession.mockResolvedValue(mockSessionVal);

      const result = await requireAdmin();
      expect(result).toEqual(mockSessionVal);
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("returns session if user is super_admin", async () => {
      const mockSessionVal = {
        user: { id: "user-1", role: "super_admin" },
        session: { id: "session-1" },
      } as unknown as Session;
      mockGetSession.mockResolvedValue(mockSessionVal);

      const result = await requireAdmin();
      expect(result).toEqual(mockSessionVal);
      expect(mockRedirect).not.toHaveBeenCalled();
    });
  });
});
