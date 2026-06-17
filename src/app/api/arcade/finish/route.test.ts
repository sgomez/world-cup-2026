import { errAsync, okAsync } from "neverthrow";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSession } from "@/lib/session";
import { domainError } from "@/modules/arcade/domain/errors";

const mockFinishRun = vi.fn();

vi.mock("@/lib/container", () => ({
  container: {
    arcade: () => ({
      finishRun: mockFinishRun,
    }),
  },
}));

vi.mock("@/lib/session", () => ({
  getSession: vi.fn(),
}));

const mockGetSession = vi.mocked(getSession);

describe("POST /api/arcade/finish", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/arcade/finish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId: "run-1" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 200 when run is finished successfully", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-alice", role: "user" },
      session: { id: "session-1" },
    } as any);

    mockFinishRun.mockReturnValue(okAsync(undefined));

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/arcade/finish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId: "run-1" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("returns 404 when run is not found", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-alice", role: "user" },
      session: { id: "session-1" },
    } as any);

    mockFinishRun.mockReturnValue(errAsync(domainError("RUN_NOT_FOUND")));

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/arcade/finish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId: "no-such-run" }),
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

    mockFinishRun.mockReturnValue(errAsync(domainError("RUN_NOT_IN_PROGRESS")));

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/arcade/finish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId: "run-1" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "RUN_NOT_IN_PROGRESS" });
  });

  it("returns 400 when runId is missing from body", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-alice", role: "user" },
      session: { id: "session-1" },
    } as any);

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/arcade/finish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
