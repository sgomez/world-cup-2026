import { errAsync, okAsync } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSession } from "@/lib/session";
import { domainError } from "@/modules/leaderboard/domain/errors";
import { GET } from "./route";

const mockRankHistory = vi.fn();

vi.mock("@/lib/container", () => ({
  container: {
    leaderboard: () => ({
      rankHistory: mockRankHistory,
    }),
  },
}));

vi.mock("@/lib/session", () => ({
  getSession: vi.fn(),
}));

const mockGetSession = vi.mocked(getSession);

describe("GET /api/communities/[slug]/rank-history", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 if unauthorized (no session)", async () => {
    mockGetSession.mockResolvedValue(null);

    const req = new Request(
      "http://localhost/api/communities/champs/rank-history",
    );
    const context = { params: Promise.resolve({ slug: "champs" }) };

    const res = await GET(req, context);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 404 if community is not found", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", role: "user" },
      session: { id: "session-1" },
    } as any);
    mockRankHistory.mockReturnValue(errAsync(domainError("NOT_FOUND")));

    const req = new Request(
      "http://localhost/api/communities/non-existent/rank-history",
    );
    const context = { params: Promise.resolve({ slug: "non-existent" }) };

    const res = await GET(req, context);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Community not found" });
    expect(mockRankHistory).toHaveBeenCalledWith({
      viewerId: "user-1",
      communitySlug: "non-existent",
    });
  });

  it("returns 403 if forbidden (viewer not a member)", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", role: "user" },
      session: { id: "session-1" },
    } as any);
    mockRankHistory.mockReturnValue(errAsync(domainError("FORBIDDEN")));

    const req = new Request(
      "http://localhost/api/communities/champs/rank-history",
    );
    const context = { params: Promise.resolve({ slug: "champs" }) };

    const res = await GET(req, context);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Forbidden" });
  });

  it("returns 200 with rank history data on success", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", role: "user" },
      session: { id: "session-1" },
    } as any);

    const mockResponseData = {
      bets: [
        {
          id: "bet-1",
          userId: "user-1",
          label: { obfuscated: false, value: "Alice" },
        },
      ],
      steps: [
        {
          matchNum: 0,
          isLive: false,
          ranks: { "bet-1": { rank: 1, points: 0 } },
        },
      ],
    };
    mockRankHistory.mockReturnValue(okAsync(mockResponseData));

    const req = new Request(
      "http://localhost/api/communities/champs/rank-history",
    );
    const context = { params: Promise.resolve({ slug: "champs" }) };

    const res = await GET(req, context);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(mockResponseData);
  });
});
