import { errAsync, okAsync } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSession } from "@/lib/session";
import { domainError } from "@/modules/arcade/domain/errors";

const mockRecordRound = vi.fn();

vi.mock("@/lib/container", () => ({
  container: {
    arcade: () => ({
      recordRound: mockRecordRound,
    }),
  },
}));

vi.mock("@/lib/session", () => ({
  getSession: vi.fn(),
}));

const mockGetSession = vi.mocked(getSession);

describe("POST /api/arcade/round", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/arcade/round", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runId: "run-1",
        roundStartedAt: "2026-06-17T10:00:05.000Z",
        reportedScore: 50,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 200 with run data when round is recorded", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-alice", role: "user" },
      session: { id: "session-1" },
    } as any);

    const fakeRun = {
      id: "run-1",
      userId: "user-alice",
      playDay: "2026-06-17",
      status: "in_progress",
      bestScore: 50,
      rounds: [
        {
          roundNumber: 1,
          startedAt: new Date("2026-06-17T10:00:05Z"),
          endedAt: new Date("2026-06-17T10:01:05Z"),
          score: 50,
        },
      ],
    };
    mockRecordRound.mockReturnValue(okAsync({ run: fakeRun }));

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/arcade/round", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runId: "run-1",
        roundStartedAt: "2026-06-17T10:00:05.000Z",
        reportedScore: 50,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("run-1");
    expect(body.bestScore).toBe(50);
    expect(body.status).toBe("in_progress");
  });

  it("returns 404 when run is not found", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-alice", role: "user" },
      session: { id: "session-1" },
    } as any);

    mockRecordRound.mockReturnValue(errAsync(domainError("RUN_NOT_FOUND")));

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/arcade/round", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runId: "no-such-run",
        roundStartedAt: "2026-06-17T10:00:05.000Z",
        reportedScore: 50,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "RUN_NOT_FOUND" });
  });

  it("returns 409 when run is not in_progress", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-alice", role: "user" },
      session: { id: "session-1" },
    } as any);

    mockRecordRound.mockReturnValue(
      errAsync(domainError("RUN_NOT_IN_PROGRESS")),
    );

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/arcade/round", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runId: "run-1",
        roundStartedAt: "2026-06-17T10:00:05.000Z",
        reportedScore: 50,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "RUN_NOT_IN_PROGRESS" });
  });

  it("returns 400 when required fields are missing", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-alice", role: "user" },
      session: { id: "session-1" },
    } as any);

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/arcade/round", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId: "run-1" }), // missing roundStartedAt + reportedScore
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
