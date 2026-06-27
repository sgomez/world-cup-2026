import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSession } from "@/lib/session";

const mockGetRanking = vi.fn();

vi.mock("@/lib/container", () => ({
  container: {
    arcade: () => ({
      getRanking: mockGetRanking,
    }),
  },
}));

vi.mock("@/lib/session", () => ({
  getSession: vi.fn(),
}));

const mockGetSession = vi.mocked(getSession);

describe("GET /api/arcade/ranking", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);

    const { GET } = await import("./route");
    const req = new Request("http://localhost/api/arcade/ranking", {
      method: "GET",
    });

    const res = await GET(req);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 200 with ranked entries when authenticated (no period)", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-alice", role: "user" },
      session: { id: "session-1" },
    } as any);

    const fakeRanking = [
      {
        rank: 1,
        userId: "user-bob",
        bestScore: 100,
        achievedAt: new Date("2026-06-17T10:00:00Z"),
      },
      {
        rank: 2,
        userId: "user-alice",
        bestScore: 42,
        achievedAt: new Date("2026-06-17T09:00:00Z"),
      },
    ];
    mockGetRanking.mockResolvedValue(fakeRanking);

    const { GET } = await import("./route");
    const req = new Request("http://localhost/api/arcade/ranking", {
      method: "GET",
    });

    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entries).toHaveLength(2);
    expect(body.entries[0].rank).toBe(1);
    expect(body.entries[0].userId).toBe("user-bob");
    expect(body.entries[0].bestScore).toBe(100);
    // No period provided — getRanking called with undefined period
    expect(mockGetRanking).toHaveBeenCalledWith(undefined, undefined);
  });

  it("passes period=daily to getRanking", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-alice", role: "user" },
      session: { id: "session-1" },
    } as any);
    mockGetRanking.mockResolvedValue([]);

    const { GET } = await import("./route");
    const req = new Request(
      "http://localhost/api/arcade/ranking?period=daily",
      { method: "GET" },
    );

    await GET(req);
    expect(mockGetRanking).toHaveBeenCalledWith(undefined, "daily");
  });

  it("passes period=weekly to getRanking", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-alice", role: "user" },
      session: { id: "session-1" },
    } as any);
    mockGetRanking.mockResolvedValue([]);

    const { GET } = await import("./route");
    const req = new Request(
      "http://localhost/api/arcade/ranking?period=weekly",
      { method: "GET" },
    );

    await GET(req);
    expect(mockGetRanking).toHaveBeenCalledWith(undefined, "weekly");
  });

  it("passes period=all_time to getRanking", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-alice", role: "user" },
      session: { id: "session-1" },
    } as any);
    mockGetRanking.mockResolvedValue([]);

    const { GET } = await import("./route");
    const req = new Request(
      "http://localhost/api/arcade/ranking?period=all_time",
      { method: "GET" },
    );

    await GET(req);
    expect(mockGetRanking).toHaveBeenCalledWith(undefined, "all_time");
  });

  it("ignores unknown period values and passes undefined", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-alice", role: "user" },
      session: { id: "session-1" },
    } as any);
    mockGetRanking.mockResolvedValue([]);

    const { GET } = await import("./route");
    const req = new Request(
      "http://localhost/api/arcade/ranking?period=unknown",
      { method: "GET" },
    );

    await GET(req);
    expect(mockGetRanking).toHaveBeenCalledWith(undefined, undefined);
  });

  it("returns 500 when getRanking throws", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-alice", role: "user" },
      session: { id: "session-1" },
    } as any);

    mockGetRanking.mockRejectedValue(new Error("DB failure"));

    const { GET } = await import("./route");
    const req = new Request("http://localhost/api/arcade/ranking", {
      method: "GET",
    });

    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});
