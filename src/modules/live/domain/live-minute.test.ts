import { describe, expect, it } from "vitest";
import { estimateLiveMinute } from "./live-minute";

const T0 = new Date("2026-06-11T19:30:00Z"); // updatedAt reference
const T1_30s = new Date("2026-06-11T19:30:30Z"); // +30s
const T1_90s = new Date("2026-06-11T19:31:30Z"); // +90s → +1 min
const T1_3m = new Date("2026-06-11T19:33:00Z"); // +3 min

describe("estimateLiveMinute", () => {
  it("returns null for finished phase", () => {
    expect(estimateLiveMinute("finished", 90, false, T0, T0)).toBeNull();
  });

  it("returns null for penalties phase", () => {
    expect(estimateLiveMinute("penalties", null, false, T0, T0)).toBeNull();
  });

  it("returns null for null/undefined phase", () => {
    expect(estimateLiveMinute(null, 30, false, T0, T0)).toBeNull();
    expect(estimateLiveMinute(undefined, 30, false, T0, T0)).toBeNull();
  });

  it("returns '0' for not_started phase", () => {
    expect(estimateLiveMinute("not_started", null, false, T0, T0)).toBe("0'");
    expect(estimateLiveMinute("not_started", 0, false, T0, T0)).toBe("0'");
  });

  it("returns plain minute during first_half when below ceiling", () => {
    expect(estimateLiveMinute("first_half", 30, false, T0, T0)).toBe("30'");
  });

  it("advances minute by elapsed time since updatedAt", () => {
    // +90s = 1 min elapsed
    expect(estimateLiveMinute("first_half", 30, false, T0, T1_90s)).toBe("31'");
    // +3min elapsed
    expect(estimateLiveMinute("first_half", 30, false, T0, T1_3m)).toBe("33'");
  });

  it("does not advance for <60s elapsed", () => {
    // only 30s elapsed — floor(30/60) = 0
    expect(estimateLiveMinute("first_half", 30, false, T0, T1_30s)).toBe("30'");
  });

  it("clamps first_half at 45 and shows stoppage marker '45+'", () => {
    // stored = 44, now at updatedAt → 44'
    expect(estimateLiveMinute("first_half", 44, false, T0, T0)).toBe("44'");
    // stored = 45, now at updatedAt → clamped = 45, at ceiling → "45+"
    expect(estimateLiveMinute("first_half", 45, false, T0, T0)).toBe("45+");
    // stored = 43, +3min elapsed = 46 → past ceiling → "45+"
    expect(estimateLiveMinute("first_half", 43, false, T0, T1_3m)).toBe("45+");
  });

  it("clamps second_half at 90 and shows '90+'", () => {
    expect(estimateLiveMinute("second_half", 88, false, T0, T0)).toBe("88'");
    expect(estimateLiveMinute("second_half", 90, false, T0, T0)).toBe("90+");
    expect(estimateLiveMinute("second_half", 88, false, T0, T1_3m)).toBe("90+");
  });

  it("clamps extra_time at 120 and shows '120+'", () => {
    expect(estimateLiveMinute("extra_time", 115, false, T0, T0)).toBe("115'");
    expect(estimateLiveMinute("extra_time", 120, false, T0, T0)).toBe("120+");
    expect(estimateLiveMinute("extra_time", 118, false, T0, T1_3m)).toBe(
      "120+",
    );
  });

  it("shows stoppage marker when inStoppage=true, even below ceiling", () => {
    expect(estimateLiveMinute("first_half", 42, true, T0, T0)).toBe("45+");
    expect(estimateLiveMinute("second_half", 85, true, T0, T0)).toBe("90+");
  });

  it("handles missing updatedAt by not advancing", () => {
    const now = new Date(T0.getTime() + 5 * 60 * 1000);
    expect(estimateLiveMinute("first_half", 20, false, undefined, now)).toBe(
      "20'",
    );
  });
});
