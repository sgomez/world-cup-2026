import { afterEach, describe, expect, it, vi } from "vitest";

describe("BET_DEADLINE", () => {
  it("is a Date instance", async () => {
    const { BET_DEADLINE } = await import("./bet");
    expect(BET_DEADLINE).toBeInstanceOf(Date);
  });

  it("equals 2026-06-11T19:00:00Z", async () => {
    const { BET_DEADLINE } = await import("./bet");
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
    const { MAX_BETS_PER_USER } = await import("./bet");
    expect(MAX_BETS_PER_USER).toBe(3);
  });

  it("reads integer from env var", async () => {
    process.env.MAX_BETS_PER_USER = "5";
    const { MAX_BETS_PER_USER } = await import("./bet");
    expect(MAX_BETS_PER_USER).toBe(5);
  });

  it("falls back to 3 when env var is non-numeric", async () => {
    process.env.MAX_BETS_PER_USER = "abc";
    const { MAX_BETS_PER_USER } = await import("./bet");
    expect(MAX_BETS_PER_USER).toBe(3);
  });

  it("is a number", async () => {
    const { MAX_BETS_PER_USER } = await import("./bet");
    expect(typeof MAX_BETS_PER_USER).toBe("number");
  });
});

describe("SHOW_IMPORTED_NAMES", () => {
  const ORIGINAL = process.env.SHOW_IMPORTED_NAMES;

  afterEach(() => {
    if (ORIGINAL === undefined) {
      delete process.env.SHOW_IMPORTED_NAMES;
    } else {
      process.env.SHOW_IMPORTED_NAMES = ORIGINAL;
    }
    vi.resetModules();
  });

  it("defaults to false when env var is absent", async () => {
    delete process.env.SHOW_IMPORTED_NAMES;
    const { SHOW_IMPORTED_NAMES } = await import("./bet");
    expect(SHOW_IMPORTED_NAMES).toBe(false);
  });

  it("resolves to true when env var is '1'", async () => {
    process.env.SHOW_IMPORTED_NAMES = "1";
    const { SHOW_IMPORTED_NAMES } = await import("./bet");
    expect(SHOW_IMPORTED_NAMES).toBe(true);
  });

  it("resolves to false when env var is '0'", async () => {
    process.env.SHOW_IMPORTED_NAMES = "0";
    const { SHOW_IMPORTED_NAMES } = await import("./bet");
    expect(SHOW_IMPORTED_NAMES).toBe(false);
  });
});
