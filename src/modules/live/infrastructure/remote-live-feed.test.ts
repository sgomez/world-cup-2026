import { describe, expect, it } from "vitest";
import type { Match } from "@/modules/schedule";
import { LiveResult } from "../domain/live-result";
import { RemoteLiveFeed } from "./remote-live-feed";

const mockMatch: Match = {
  num: 1,
  round: "Group Stage",
  date: "2026-06-11",
  time: "13:00 UTC-6",
  team1: "MEX",
  team2: "USA",
  ground: "Stadium",
};

function makeLiveResult(
  overrides: Partial<Parameters<typeof LiveResult.fromState>[0]> = {},
) {
  return LiveResult.fromState({
    num: 1,
    status: "live",
    goals1: 0,
    goals2: 0,
    ...overrides,
  });
}

/** Build a minimal HTML page body that represents the two states */
function buildLivePage(goals1: number, goals2: number): string {
  return `
    <html>
      <body>
        <span class="live-light"></span>
        <p class="score-board__content__score__point">${goals1}</p>
        <p class="score-board__content__score__point">${goals2}</p>
      </body>
    </html>
  `;
}

function buildFinishedPage(goals1: number, goals2: number): string {
  return `
    <html>
      <body>
        <p class="score-board__content__score__point">${goals1}</p>
        <p class="score-board__content__score__point">${goals2}</p>
      </body>
    </html>
  `;
}

function buildNoScorePage(): string {
  return `
    <html>
      <body>
        <p>Match not started yet</p>
      </body>
    </html>
  `;
}

function makeFetch(response: { ok: boolean; text?: string; throws?: Error }) {
  return async (_url: string, _init?: RequestInit): Promise<Response> => {
    if (response.throws) {
      throw response.throws;
    }
    const text = response.text ?? "";
    return {
      ok: response.ok,
      status: response.ok ? 200 : 500,
      text: async () => text,
    } as Response;
  };
}

describe("RemoteLiveFeed", () => {
  it("returns Err when current has no Match Link", async () => {
    const current = makeLiveResult({ link: undefined });
    const feed = new RemoteLiveFeed(
      makeFetch({ ok: true, text: buildLivePage(1, 0) }),
    );
    const result = await feed.fetchSnapshot(mockMatch, current);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toMatch(/link/i);
  });

  it("returns Err when current is null (no link)", async () => {
    const feed = new RemoteLiveFeed(
      makeFetch({ ok: true, text: buildLivePage(0, 0) }),
    );
    const result = await feed.fetchSnapshot(mockMatch, null);
    expect(result.isErr()).toBe(true);
  });

  it("live page → finished:false + page goals", async () => {
    const current = makeLiveResult({
      link: "https://example.com/match/1",
      goals1: 0,
      goals2: 0,
    });
    const feed = new RemoteLiveFeed(
      makeFetch({ ok: true, text: buildLivePage(2, 1) }),
    );
    const result = await feed.fetchSnapshot(mockMatch, current);
    expect(result.isOk()).toBe(true);
    const snapshot = result._unsafeUnwrap();
    expect(snapshot.finished).toBe(false);
    expect(snapshot.goals1).toBe(2);
    expect(snapshot.goals2).toBe(1);
  });

  it("finished page (scoreline, no live indicator) → finished:true + page goals", async () => {
    const current = makeLiveResult({
      link: "https://example.com/match/1",
      goals1: 1,
      goals2: 1,
    });
    const feed = new RemoteLiveFeed(
      makeFetch({ ok: true, text: buildFinishedPage(3, 2) }),
    );
    const result = await feed.fetchSnapshot(mockMatch, current);
    expect(result.isOk()).toBe(true);
    const snapshot = result._unsafeUnwrap();
    expect(snapshot.finished).toBe(true);
    expect(snapshot.goals1).toBe(3);
    expect(snapshot.goals2).toBe(2);
  });

  it("no-scoreline page → finished:false + echoed current goals (protects delayed kickoff)", async () => {
    const current = makeLiveResult({
      link: "https://example.com/match/1",
      goals1: 0,
      goals2: 0,
    });
    const feed = new RemoteLiveFeed(
      makeFetch({ ok: true, text: buildNoScorePage() }),
    );
    const result = await feed.fetchSnapshot(mockMatch, current);
    expect(result.isOk()).toBe(true);
    const snapshot = result._unsafeUnwrap();
    expect(snapshot.finished).toBe(false);
    expect(snapshot.goals1).toBe(0);
    expect(snapshot.goals2).toBe(0);
  });

  it("penalties from current are echoed through, never overwritten", async () => {
    const current = LiveResult.fromState({
      num: 73,
      status: "live",
      goals1: 1,
      goals2: 1,
      penalties1: 5,
      penalties2: 4,
      link: "https://example.com/match/73",
    });
    const feed = new RemoteLiveFeed(
      makeFetch({ ok: true, text: buildLivePage(1, 1) }),
    );
    const result = await feed.fetchSnapshot({ ...mockMatch, num: 73 }, current);
    expect(result.isOk()).toBe(true);
    const snapshot = result._unsafeUnwrap();
    expect(snapshot.penalties1).toBe(5);
    expect(snapshot.penalties2).toBe(4);
  });

  it("returns Err on non-success HTTP status", async () => {
    const current = makeLiveResult({ link: "https://example.com/match/1" });
    const feed = new RemoteLiveFeed(
      makeFetch({ ok: false, text: "Internal Server Error" }),
    );
    const result = await feed.fetchSnapshot(mockMatch, current);
    expect(result.isErr()).toBe(true);
  });

  it("returns Err when fetch throws (unreachable host)", async () => {
    const current = makeLiveResult({ link: "https://example.com/match/1" });
    const feed = new RemoteLiveFeed(
      makeFetch({ ok: false, throws: new Error("ECONNREFUSED") }),
    );
    const result = await feed.fetchSnapshot(mockMatch, current);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toContain("ECONNREFUSED");
  });
});
