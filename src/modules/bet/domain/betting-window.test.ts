import { describe, expect, it, vi } from "vitest";
import { BettingWindow } from "./betting-window";

const DEADLINE = new Date("2026-06-11T19:00:00Z");

describe("BettingWindow", () => {
  it("is open before the deadline", () => {
    const window = new BettingWindow(DEADLINE);
    expect(window.isOpen(new Date("2026-06-10T00:00:00Z"))).toBe(true);
  });

  it("is open exactly at the deadline", () => {
    const window = new BettingWindow(DEADLINE);
    expect(window.isOpen(DEADLINE)).toBe(true);
  });

  it("is closed after the deadline", () => {
    const window = new BettingWindow(DEADLINE);
    expect(window.isOpen(new Date("2026-06-12T00:00:00Z"))).toBe(false);
  });

  it("reads the deadline live (respects a mutated getTime)", () => {
    const window = new BettingWindow(DEADLINE);
    const now = new Date("2026-06-10T00:00:00Z");
    const spy = vi
      .spyOn(DEADLINE, "getTime")
      .mockReturnValue(now.getTime() - 1000);
    expect(window.isOpen(now)).toBe(false);
    spy.mockRestore();
  });
});
