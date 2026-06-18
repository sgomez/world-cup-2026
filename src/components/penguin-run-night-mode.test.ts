import { describe, expect, it } from "vitest";
import { isNightMode } from "./penguin-run-night-mode";

// ---------------------------------------------------------------------------
// isNightMode(score, interval, duration)
//
// Returns true when the play-box should render in night (inverted) palette.
// Parameterised so tests are independent of production constants.
//
// Formula: score >= interval && score % interval < duration
//
// This matches the Chrome dino model:
//   - The very first night window opens at the END of the first interval
//     (score === interval), NOT at the start of the run.
//   - Scores 1 … interval-1 are always day.
//   - Each subsequent cycle reopens night at score === 2*interval, 3*interval…
// ---------------------------------------------------------------------------

describe("isNightMode", () => {
  // -------------------------------------------------------------------------
  // Cycle 1 — scores before the first interval are day
  // -------------------------------------------------------------------------
  it("returns false at score 0 (before first interval)", () => {
    expect(isNightMode(0, 150, 35)).toBe(false);
  });

  it("returns false at score 1 (bug guard: must not open night at second 1)", () => {
    expect(isNightMode(1, 150, 35)).toBe(false);
  });

  it("returns false just before the first interval", () => {
    expect(isNightMode(149, 150, 35)).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Cycle 2 — night window opens at exactly score === interval
  // -------------------------------------------------------------------------
  it("returns true at the exact threshold score (first night window opens)", () => {
    expect(isNightMode(150, 150, 35)).toBe(true);
  });

  it("returns true in the middle of the first night window", () => {
    expect(isNightMode(184, 150, 35)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Cycle 3 — window closes at threshold + duration
  // -------------------------------------------------------------------------
  it("returns false once the night window closes (score = interval + duration)", () => {
    expect(isNightMode(185, 150, 35)).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Cycle 4 — second night cycle fires at 2× interval
  // -------------------------------------------------------------------------
  it("returns true at the start of the second night cycle", () => {
    expect(isNightMode(300, 150, 35)).toBe(true);
  });
});
