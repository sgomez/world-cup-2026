import { beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryLiveResultRepository } from "@/modules/live/infrastructure/in-memory-live-result-repository";

// Shared in-memory repo instance for the test suite.
// Each test replaces this with a fresh InMemoryLiveResultRepository in beforeEach.
let sharedRepo: InMemoryLiveResultRepository;

// Replace the Prisma repo with the in-memory one for tests.
// The constructor return trick lets the mock return the per-test sharedRepo instance.
vi.mock("@/modules/live/infrastructure/prisma-live-result-repository", () => {
  return {
    PrismaLiveResultRepository: class FakeRepo {
      constructor() {
        // biome-ignore lint/correctness/noConstructorReturn: test double returns shared in-memory repo
        return sharedRepo;
      }
    },
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

const VALID_TOKEN = "test-live-feed-token";

function makeRequest(
  method: "PUT" | "PATCH",
  body: unknown,
  token?: string,
): Request {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token !== undefined) {
    headers.Authorization = `Bearer ${token}`;
  }
  return new Request("http://localhost/api/live/matches/1", {
    method,
    headers,
    body: JSON.stringify(body),
  });
}

function makeParams(num: string) {
  return Promise.resolve({ num });
}

describe("PUT /api/live/matches/[num]", () => {
  beforeEach(() => {
    sharedRepo = new InMemoryLiveResultRepository();
    vi.stubEnv("LIVE_FEED_TOKEN", VALID_TOKEN);
  });

  it("returns 503 when LIVE_FEED_TOKEN env var is unset", async () => {
    vi.stubEnv("LIVE_FEED_TOKEN", "");
    const { PUT } = await import("./route");
    const req = makeRequest("PUT", {
      status: "live",
      goals1: 0,
      goals2: 0,
    });
    const res = await PUT(req, { params: makeParams("1") });
    expect(res.status).toBe(503);
  });

  it("returns 401 when token is missing", async () => {
    const { PUT } = await import("./route");
    const reqNoAuth = new Request("http://localhost/api/live/matches/1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "live", goals1: 0, goals2: 0 }),
    });
    const res = await PUT(reqNoAuth, { params: makeParams("1") });
    expect(res.status).toBe(401);
  });

  it("returns 401 when token is wrong", async () => {
    const { PUT } = await import("./route");
    const req = makeRequest(
      "PUT",
      { status: "live", goals1: 0, goals2: 0 },
      "wrong-token",
    );
    const res = await PUT(req, { params: makeParams("1") });
    expect(res.status).toBe(401);
  });

  it("returns 404 for unknown match number", async () => {
    const { PUT } = await import("./route");
    const req = makeRequest(
      "PUT",
      { status: "live", goals1: 0, goals2: 0 },
      VALID_TOKEN,
    );
    const res = await PUT(req, { params: makeParams("999") });
    expect(res.status).toBe(404);
  });

  it("returns 200 for valid PUT creating a new LiveResult", async () => {
    const { PUT } = await import("./route");
    const req = makeRequest(
      "PUT",
      { status: "live", goals1: 0, goals2: 0 },
      VALID_TOKEN,
    );
    const res = await PUT(req, { params: makeParams("1") });
    expect(res.status).toBe(200);
  });

  it("returns 200 for valid PUT creating a new LiveResult with status upcoming", async () => {
    const { PUT } = await import("./route");
    const req = makeRequest(
      "PUT",
      { status: "upcoming", goals1: 0, goals2: 0 },
      VALID_TOKEN,
    );
    const res = await PUT(req, { params: makeParams("1") });
    expect(res.status).toBe(200);
  });

  it("returns 422 for invalid goals (negative)", async () => {
    const { PUT } = await import("./route");
    const req = makeRequest(
      "PUT",
      { status: "live", goals1: -1, goals2: 0 },
      VALID_TOKEN,
    );
    const res = await PUT(req, { params: makeParams("1") });
    expect(res.status).toBe(422);
  });

  it("returns 422 when penalties provided on a group match", async () => {
    const { PUT } = await import("./route");
    const req = makeRequest(
      "PUT",
      {
        status: "finished",
        goals1: 1,
        goals2: 1,
        penalties1: 4,
        penalties2: 3,
      },
      VALID_TOKEN,
    );
    const res = await PUT(req, { params: makeParams("1") });
    expect(res.status).toBe(422);
  });

  it("returns 422 when body is missing goals1", async () => {
    const { PUT } = await import("./route");
    const req = makeRequest("PUT", { status: "live", goals2: 0 }, VALID_TOKEN);
    const res = await PUT(req, { params: makeParams("1") });
    expect(res.status).toBe(422);
  });

  it("returns 422 when body is missing goals2", async () => {
    const { PUT } = await import("./route");
    const req = makeRequest("PUT", { status: "live", goals1: 0 }, VALID_TOKEN);
    const res = await PUT(req, { params: makeParams("1") });
    expect(res.status).toBe(422);
  });

  it("returns 422 when body is missing status", async () => {
    const { PUT } = await import("./route");
    const req = makeRequest("PUT", { goals1: 0, goals2: 0 }, VALID_TOKEN);
    const res = await PUT(req, { params: makeParams("1") });
    expect(res.status).toBe(422);
  });

  it("returns 422 when goals1 is not a number", async () => {
    const { PUT } = await import("./route");
    const req = makeRequest(
      "PUT",
      { status: "live", goals1: "two", goals2: 0 },
      VALID_TOKEN,
    );
    const res = await PUT(req, { params: makeParams("1") });
    expect(res.status).toBe(422);
  });

  it("returns 422 when body is empty object", async () => {
    const { PUT } = await import("./route");
    const req = makeRequest("PUT", {}, VALID_TOKEN);
    const res = await PUT(req, { params: makeParams("1") });
    expect(res.status).toBe(422);
  });

  it("returns 400 for invalid JSON body", async () => {
    const { PUT } = await import("./route");
    const req = new Request("http://localhost/api/live/matches/1", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${VALID_TOKEN}`,
      },
      body: "not-json",
    });
    const res = await PUT(req, { params: makeParams("1") });
    expect(res.status).toBe(400);
  });

  it("returns 200 when re-sending identical snapshot (idempotent)", async () => {
    const { PUT } = await import("./route");
    const body = { status: "live", goals1: 1, goals2: 0 };

    const req1 = makeRequest("PUT", body, VALID_TOKEN);
    await PUT(req1, { params: makeParams("5") });

    const req2 = makeRequest("PUT", body, VALID_TOKEN);
    const res2 = await PUT(req2, { params: makeParams("5") });
    expect(res2.status).toBe(200);
    const data = await res2.json();
    expect(data.events).toHaveLength(0);
  });
});

describe("PATCH /api/live/matches/[num]", () => {
  beforeEach(() => {
    sharedRepo = new InMemoryLiveResultRepository();
    vi.stubEnv("LIVE_FEED_TOKEN", VALID_TOKEN);
  });

  it("returns 404 when PATCH is called with no existing row", async () => {
    const { PATCH } = await import("./route");
    const req = makeRequest(
      "PATCH",
      { status: "live", goals1: 1, goals2: 0 },
      VALID_TOKEN,
    );
    const res = await PATCH(req, { params: makeParams("2") });
    expect(res.status).toBe(404);
  });

  it("returns 200 when PATCH updates existing row", async () => {
    const { PUT, PATCH } = await import("./route");

    // First create via PUT
    const putReq = makeRequest(
      "PUT",
      { status: "live", goals1: 0, goals2: 0 },
      VALID_TOKEN,
    );
    await PUT(putReq, { params: makeParams("3") });

    const patchReq = makeRequest(
      "PATCH",
      { status: "live", goals1: 1, goals2: 0 },
      VALID_TOKEN,
    );
    const res = await PATCH(patchReq, { params: makeParams("3") });
    expect(res.status).toBe(200);
  });

  it("returns 401 when token is missing on PATCH", async () => {
    const { PATCH } = await import("./route");
    const req = new Request("http://localhost/api/live/matches/1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "live", goals1: 1, goals2: 0 }),
    });
    const res = await PATCH(req, { params: makeParams("1") });
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/live/matches/[num] — link update", () => {
  beforeEach(() => {
    sharedRepo = new InMemoryLiveResultRepository();
    vi.stubEnv("LIVE_FEED_TOKEN", VALID_TOKEN);
  });

  it("returns 200 when link is set on an existing row", async () => {
    const { PUT, PATCH } = await import("./route");

    // Ensure num 7 exists (use a num no other test in this suite creates)
    const putReq = makeRequest(
      "PUT",
      { status: "upcoming", goals1: 0, goals2: 0 },
      VALID_TOKEN,
    );
    await PUT(putReq, { params: makeParams("7") });

    const patchReq = new Request("http://localhost/api/live/matches/7", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${VALID_TOKEN}`,
      },
      body: JSON.stringify({ link: "https://example.com/match/7" }),
    });
    const res = await PATCH(patchReq, { params: makeParams("7") });
    expect(res.status).toBe(200);
  });

  it("returns 404 when link PATCH targets non-existent row", async () => {
    const { PATCH } = await import("./route");
    // num 88 is never created by any other test in this suite
    const req = new Request("http://localhost/api/live/matches/88", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${VALID_TOKEN}`,
      },
      body: JSON.stringify({ link: "https://example.com/match/88" }),
    });
    const res = await PATCH(req, { params: makeParams("88") });
    expect(res.status).toBe(404);
  });

  it("returns 422 when link is not a valid URL", async () => {
    const { PATCH } = await import("./route");
    const req = new Request("http://localhost/api/live/matches/1", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${VALID_TOKEN}`,
      },
      body: JSON.stringify({ link: "not-a-url" }),
    });
    const res = await PATCH(req, { params: makeParams("1") });
    expect(res.status).toBe(422);
  });
});
