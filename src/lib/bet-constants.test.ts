import { afterEach, describe, expect, it, vi } from "vitest";

describe("BET_DEADLINE", () => {
  it("is a Date instance", async () => {
    const { BET_DEADLINE } = await import("./bet-constants");
    expect(BET_DEADLINE).toBeInstanceOf(Date);
  });

  it("equals 2026-06-11T19:00:00Z", async () => {
    const { BET_DEADLINE } = await import("./bet-constants");
    expect(BET_DEADLINE.toISOString()).toBe("2026-06-11T19:00:00.000Z");
  });
});

describe("MAX_BETS_PER_USER", () => {
  const ORIGINAL = process.env.MAX_BETS_PER_USER;

  afterEach(() => {
    if (ORIGINAL === undefined) {
      delete process.env.MAX_BETS_PER_USER;
    } else {
      process.env.MAX_BETS_PER_USER = ORIGINAL;
    }
    vi.resetModules();
  });

  it("defaults to 3 when env var is absent", async () => {
    delete process.env.MAX_BETS_PER_USER;
    const { MAX_BETS_PER_USER } = await import("./bet-constants");
    expect(MAX_BETS_PER_USER).toBe(3);
  });

  it("reads integer from env var", async () => {
    process.env.MAX_BETS_PER_USER = "5";
    const { MAX_BETS_PER_USER } = await import("./bet-constants");
    expect(MAX_BETS_PER_USER).toBe(5);
  });

  it("falls back to 3 when env var is non-numeric", async () => {
    process.env.MAX_BETS_PER_USER = "abc";
    const { MAX_BETS_PER_USER } = await import("./bet-constants");
    expect(MAX_BETS_PER_USER).toBe(3);
  });

  it("is a number", async () => {
    const { MAX_BETS_PER_USER } = await import("./bet-constants");
    expect(typeof MAX_BETS_PER_USER).toBe("number");
  });
});

describe("TOURNAMENT_ENDED", () => {
  it("defaults to false", async () => {
    const { TOURNAMENT_ENDED } = await import("./bet-constants");
    expect(TOURNAMENT_ENDED).toBe(false);
  });

  it("is a boolean", async () => {
    const { TOURNAMENT_ENDED } = await import("./bet-constants");
    expect(typeof TOURNAMENT_ENDED).toBe("boolean");
  });
});
