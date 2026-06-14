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
            NOT_FOUND: "Match not found.",
            INVALID_NUM: "Invalid match number.",
            INVALID_GOALS: "Invalid goals.",
            PENALTIES_NOT_ALLOWED: "Penalties not allowed.",
            SAVE_FAILED: "Save failed.",
            NOT_AUTHENTICATED: "Not authenticated",
          }) as Record<string, string>
        )[key] ?? key,
  ),
}));
vi.mock("@/i18n/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    liveResult: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));
vi.mock("@/lib/session", () => ({ getSession: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { upsertLiveResultAction } from "./live";

const mockGetSession = vi.mocked(getSession);
const mockLiveResultFindUnique = vi.mocked(prisma.liveResult.findUnique);
const mockLiveResultUpsert = vi.mocked(prisma.liveResult.upsert);

function mockAdminSession() {
  mockGetSession.mockResolvedValue({
    user: { id: "admin-1", role: "admin" },
  } as Awaited<ReturnType<typeof getSession>>);
}

function mockSuperAdminSession() {
  mockGetSession.mockResolvedValue({
    user: { id: "admin-2", role: "super_admin" },
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

describe("upsertLiveResultAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects unauthenticated requests", async () => {
    mockNoSession();

    const result = await upsertLiveResultAction({
      num: 1,
      status: "live",
      goals1: 0,
      goals2: 0,
      allowCreate: true,
    });

    expect(result).toEqual({ error: "Not authenticated" });
  });

  it("rejects non-admin users with FORBIDDEN", async () => {
    mockUserSession();

    const result = await upsertLiveResultAction({
      num: 1,
      status: "live",
      goals1: 0,
      goals2: 0,
      allowCreate: true,
    });

    expect(result).toEqual({ error: "You are not authorized." });
  });

  it("accepts admin role", async () => {
    mockAdminSession();
    mockLiveResultFindUnique.mockResolvedValue(null);
    mockLiveResultUpsert.mockResolvedValue({
      num: 1,
      status: "live",
      goals1: 0,
      goals2: 0,
      penalties1: null,
      penalties2: null,
      phase: null,
      minute: null,
      inStoppage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await upsertLiveResultAction({
      num: 1,
      status: "live",
      goals1: 0,
      goals2: 0,
      allowCreate: true,
    });

    expect(result).toEqual({ success: true });
  });

  it("accepts super_admin role", async () => {
    mockSuperAdminSession();
    mockLiveResultFindUnique.mockResolvedValue(null);
    mockLiveResultUpsert.mockResolvedValue({
      num: 1,
      status: "live",
      goals1: 0,
      goals2: 0,
      penalties1: null,
      penalties2: null,
      phase: null,
      minute: null,
      inStoppage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await upsertLiveResultAction({
      num: 1,
      status: "live",
      goals1: 0,
      goals2: 0,
      allowCreate: true,
    });

    expect(result).toEqual({ success: true });
  });

  it("returns error for invalid match number", async () => {
    mockAdminSession();

    const result = await upsertLiveResultAction({
      num: 999,
      status: "live",
      goals1: 0,
      goals2: 0,
      allowCreate: true,
    });

    expect(result).toHaveProperty("error");
    expect(result?.error).toContain("Invalid match number.");
  });

  it("returns error for negative goals", async () => {
    mockAdminSession();

    const result = await upsertLiveResultAction({
      num: 1,
      status: "live",
      goals1: -1,
      goals2: 0,
      allowCreate: true,
    });

    expect(result).toHaveProperty("error");
  });

  it("returns error when PATCH (allowCreate=false) and no existing row", async () => {
    mockAdminSession();
    mockLiveResultFindUnique.mockResolvedValue(null);

    const result = await upsertLiveResultAction({
      num: 1,
      status: "live",
      goals1: 1,
      goals2: 0,
      allowCreate: false,
    });

    expect(result).toHaveProperty("error");
  });

  it("calls revalidatePath on success", async () => {
    const { revalidatePath } = await import("next/cache");
    mockAdminSession();
    mockLiveResultFindUnique.mockResolvedValue(null);
    mockLiveResultUpsert.mockResolvedValue({
      num: 1,
      status: "finished",
      goals1: 2,
      goals2: 1,
      penalties1: null,
      penalties2: null,
      phase: null,
      minute: null,
      inStoppage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await upsertLiveResultAction({
      num: 1,
      status: "finished",
      goals1: 2,
      goals2: 1,
      allowCreate: true,
    });

    expect(revalidatePath).toHaveBeenCalledWith("/admin/result");
  });
});
