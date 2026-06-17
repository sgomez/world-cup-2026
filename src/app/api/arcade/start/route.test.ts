import { errAsync, okAsync } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSession } from "@/lib/session";
import { domainError } from "@/modules/arcade/domain/errors";

const mockStartPenguinRun = vi.fn();

vi.mock("@/lib/container", () => ({
  container: {
    arcade: () => ({
      startRun: mockStartPenguinRun,
    }),
  },
}));

vi.mock("@/lib/session", () => ({
  getSession: vi.fn(),
}));

const mockGetSession = vi.mocked(getSession);

describe("POST /api/arcade/start", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/arcade/start", {
      method: "POST",
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 201 and run data when the run is created successfully", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-alice", role: "user" },
      session: { id: "session-1" },
    } as any);

    const fakeRun = {
      id: "run-1",
      userId: "user-alice",
      playDay: "2026-06-17",
      startedAt: new Date("2026-06-17T10:00:00Z"),
      status: "in_progress",
      bestScore: 0,
    };
    mockStartPenguinRun.mockReturnValue(okAsync({ run: fakeRun }));

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/arcade/start", {
      method: "POST",
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("run-1");
    expect(body.playDay).toBe("2026-06-17");
    expect(body.status).toBe("in_progress");
  });

  it("returns 409 when the user has already played today", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-alice", role: "user" },
      session: { id: "session-1" },
    } as any);

    mockStartPenguinRun.mockReturnValue(
      errAsync(domainError("ALREADY_PLAYED_TODAY")),
    );

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/arcade/start", {
      method: "POST",
    });

    const res = await POST(req);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "ALREADY_PLAYED_TODAY" });
  });

  it("returns 500 for unexpected domain errors", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-alice", role: "user" },
      session: { id: "session-1" },
    } as any);

    mockStartPenguinRun.mockReturnValue(errAsync(domainError("SAVE_FAILED")));

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/arcade/start", {
      method: "POST",
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
