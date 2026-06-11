import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next-intl/server", () => ({
  getLocale: vi.fn().mockResolvedValue("en"),
  getTranslations: vi.fn(
    async () =>
      (key: string): string =>
        (
          ({
            FORBIDDEN: "You are not authorized.",
            SAVE_FAILED: "Save failed.",
            NOT_AUTHENTICATED: "Not authenticated",
          }) as Record<string, string>
        )[key] ?? key,
  ),
}));
vi.mock("@/i18n/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    tournament: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));
vi.mock("@/lib/session", () => ({ getSession: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import {
  setGroupTieBreakFactorAction,
  setThirdsTieBreakFactorAction,
} from "./tournament";

const mockGetSession = vi.mocked(getSession);
const mockTournamentFindUnique = vi.mocked(prisma.tournament.findUnique);
const mockTournamentUpsert = vi.mocked(prisma.tournament.upsert);

function mockAdminSession() {
  mockGetSession.mockResolvedValue({
    user: { id: "admin-1", role: "admin" },
  } as Awaited<ReturnType<typeof getSession>>);
}

function mockUserSession() {
  mockGetSession.mockResolvedValue({
    user: { id: "user-1", role: "user" },
  } as Awaited<ReturnType<typeof getSession>>);
}

function mockNoSession() {
  mockGetSession.mockResolvedValue(null);
}

describe("tournament tie-break actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("setGroupTieBreakFactorAction", () => {
    it("rejects unauthenticated requests", async () => {
      mockNoSession();
      const result = await setGroupTieBreakFactorAction("A", "esp", 5);
      expect(result).toEqual({ error: "Not authenticated" });
    });

    it("rejects non-admin users with FORBIDDEN", async () => {
      mockUserSession();
      const result = await setGroupTieBreakFactorAction("A", "esp", 5);
      expect(result).toEqual({ error: "You are not authorized." });
    });

    it("saves new factor for team", async () => {
      mockAdminSession();
      mockTournamentFindUnique.mockResolvedValue({
        id: "singleton",
        manualTieBreaks: { A: { deu: 3 } },
        thirdPlaceManualOrder: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockTournamentUpsert.mockResolvedValue({} as any);

      const result = await setGroupTieBreakFactorAction("A", "esp", 5);
      expect(result).toEqual({ success: true });
      expect(mockTournamentUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            manualTieBreaks: { A: { deu: 3, esp: 5 } },
          }),
        }),
      );
    });

    it("removes team from manualTieBreaks when factor is 0", async () => {
      mockAdminSession();
      mockTournamentFindUnique.mockResolvedValue({
        id: "singleton",
        manualTieBreaks: { A: { deu: 3, esp: 5 } },
        thirdPlaceManualOrder: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockTournamentUpsert.mockResolvedValue({} as any);

      const result = await setGroupTieBreakFactorAction("A", "esp", 0);
      expect(result).toEqual({ success: true });
      expect(mockTournamentUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            manualTieBreaks: { A: { deu: 3 } },
          }),
        }),
      );
    });
  });

  describe("setThirdsTieBreakFactorAction", () => {
    it("rejects unauthenticated requests", async () => {
      mockNoSession();
      const result = await setThirdsTieBreakFactorAction("3rd-a", 4);
      expect(result).toEqual({ error: "Not authenticated" });
    });

    it("saves thirds factor", async () => {
      mockAdminSession();
      mockTournamentFindUnique.mockResolvedValue({
        id: "singleton",
        manualTieBreaks: {},
        thirdPlaceManualOrder: { "3rd-b": 2 },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockTournamentUpsert.mockResolvedValue({} as any);

      const result = await setThirdsTieBreakFactorAction("3rd-a", 4);
      expect(result).toEqual({ success: true });
      expect(mockTournamentUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            thirdPlaceManualOrder: { "3rd-b": 2, "3rd-a": 4 },
          }),
        }),
      );
    });
  });
});
