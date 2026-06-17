import { describe, expect, it } from "vitest";
import { PenguinRun, toPlayDay } from "./penguin-run";

describe("PenguinRun aggregate", () => {
  const userId = "user-alice";

  describe("toPlayDay", () => {
    it("returns the UTC calendar date string for a timestamp", () => {
      const t = new Date("2026-06-17T23:59:59Z");
      expect(toPlayDay(t)).toBe("2026-06-17");
    });

    it("rolls over at 00:00 UTC", () => {
      const before = new Date("2026-06-17T23:59:59Z");
      const after = new Date("2026-06-18T00:00:00Z");
      expect(toPlayDay(before)).toBe("2026-06-17");
      expect(toPlayDay(after)).toBe("2026-06-18");
    });
  });

  describe("PenguinRun.create", () => {
    it("creates a run with correct userId, playDay and startedAt", () => {
      const startedAt = new Date("2026-06-17T10:00:00Z");
      const run = PenguinRun.create({ userId, startedAt });

      expect(run.userId).toBe(userId);
      expect(run.playDay).toBe("2026-06-17");
      expect(run.startedAt).toEqual(startedAt);
      expect(run.status).toBe("in_progress");
      expect(run.bestScore).toBe(0);
    });

    it("assigns a unique id", () => {
      const startedAt = new Date("2026-06-17T10:00:00Z");
      const run1 = PenguinRun.create({ userId, startedAt });
      const run2 = PenguinRun.create({ userId, startedAt });
      expect(run1.id).not.toBe(run2.id);
    });
  });

  describe("PenguinRun.fromState", () => {
    it("reconstructs a run from persisted state", () => {
      const state = {
        id: "run-1",
        userId,
        playDay: "2026-06-17",
        startedAt: new Date("2026-06-17T10:00:00Z"),
        lastSeenAt: new Date("2026-06-17T10:01:00Z"),
        status: "in_progress" as const,
        bestScore: 42,
      };
      const run = PenguinRun.fromState(state);

      expect(run.id).toBe("run-1");
      expect(run.userId).toBe(userId);
      expect(run.playDay).toBe("2026-06-17");
      expect(run.bestScore).toBe(42);
      expect(run.status).toBe("in_progress");
    });
  });

  describe("isOwnedBy", () => {
    it("returns true for the owner", () => {
      const run = PenguinRun.create({
        userId,
        startedAt: new Date("2026-06-17T10:00:00Z"),
      });
      expect(run.isOwnedBy(userId)).toBe(true);
    });

    it("returns false for another user", () => {
      const run = PenguinRun.create({
        userId,
        startedAt: new Date("2026-06-17T10:00:00Z"),
      });
      expect(run.isOwnedBy("user-bob")).toBe(false);
    });
  });
});
