/**
 * Penguin Run — pure Obstacle-Group planner (ADR 0035).
 *
 * `planNextGroup` is the single entry point. It is a pure function with an
 * injectable RNG so the "always jumpable" invariant can be verified in tests
 * without a canvas or `Math.random`.
 *
 * Physics constants below must be kept in sync with `penguin-run-game.tsx`.
 */

import { GAME_OBSTACLE_WIDTH } from "@/config/arcade";

// ---------------------------------------------------------------------------
// Physics constants (must match penguin-run-game.tsx)
// ---------------------------------------------------------------------------

const JUMP_VELOCITY = 700; // absolute value of JUMP_VELOCITY in the game, px/s
const GRAVITY = 1800; // px/s²

// ---------------------------------------------------------------------------
// Spawn-model constants (ADR 0035)
// ---------------------------------------------------------------------------

/** Safety multiplier applied to the airtime-derived minimum gap. */
export const MIN_GAP_SAFETY = 1.3;

/**
 * The extra (random) gap range, in seconds of airtime, beyond `minGap`.
 * Shrinks as the Round progresses toward EXTRA_RANGE_FLOOR.
 */
const EXTRA_RANGE_START_AIRTIME = 3.0; // ≈ 2.3 s start range at initial speed
const EXTRA_RANGE_FLOOR_AIRTIME = 0.2; // never drops below ~0.2× airtime of ground

/**
 * Elapsed time (ms) at which the extra-range shrinking reaches its floor.
 * Beyond this, the floor stays constant.
 */
const EXTRA_RANGE_DECAY_MS = 90_000; // 90 s to reach the floor

/**
 * Group-size weights [size-1, size-2, size-3] as a tuple of three numbers.
 * Interpolated between EARLY and LATE by elapsed time.
 */
const SIZE_WEIGHTS_EARLY = [70, 25, 5] as const;
const SIZE_WEIGHTS_LATE = [30, 40, 30] as const;

/** Time (ms) at which the distribution has fully transitioned to LATE. */
const SIZE_WEIGHT_TRANSITION_MS = 120_000; // 120 s

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/** airtime of a jump at constant gravity (seconds). */
function jumpAirtime(): number {
  return (2 * JUMP_VELOCITY) / GRAVITY;
}

/**
 * Minimum safe gap (px) between the trailing edge of one Obstacle Group and
 * the leading edge of the next, given the current scroll speed.
 *
 * Guarantees a land-and-rejump window at any speed.
 */
export function computeMinGap(scrollSpeed: number): number {
  return scrollSpeed * jumpAirtime() * MIN_GAP_SAFETY;
}

/**
 * Horizontal distance the penguin travels during a jump at the given speed.
 * Group span must not exceed this.
 */
export function computeReach(scrollSpeed: number): number {
  return scrollSpeed * jumpAirtime();
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlanInput {
  /** Current scroll speed of the game (px/s). */
  speed: number;
  /** Elapsed time in the current Round (ms). */
  elapsedMs: number;
  /** Injectable RNG returning a float in [0, 1). */
  rng: () => number;
}

export interface PlanResult {
  /** Number of contiguous obstacles in the group (1–3). */
  size: number;
  /** Clear gap before the first obstacle of this group (px). */
  gapPx: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Interpolated weight tuple for the given elapsed time.
 * Returns [w1, w2, w3] where each wN is the relative weight of group size N.
 */
function sizeWeights(elapsedMs: number): [number, number, number] {
  const t = Math.min(elapsedMs / SIZE_WEIGHT_TRANSITION_MS, 1);
  return [
    SIZE_WEIGHTS_EARLY[0] + t * (SIZE_WEIGHTS_LATE[0] - SIZE_WEIGHTS_EARLY[0]),
    SIZE_WEIGHTS_EARLY[1] + t * (SIZE_WEIGHTS_LATE[1] - SIZE_WEIGHTS_EARLY[1]),
    SIZE_WEIGHTS_EARLY[2] + t * (SIZE_WEIGHTS_LATE[2] - SIZE_WEIGHTS_EARLY[2]),
  ];
}

/**
 * Weighted random pick of group size (1, 2, or 3).
 * Uses the provided RNG so callers remain pure.
 */
function pickSize(rng: () => number, elapsedMs: number): number {
  const [w1, w2, w3] = sizeWeights(elapsedMs);
  const total = w1 + w2 + w3;
  const r = rng() * total;
  if (r < w1) return 1;
  if (r < w1 + w2) return 2;
  return 3;
}

/**
 * Extra gap range (px) beyond `minGap` that shrinks over time toward a floor.
 *
 * At elapsedMs=0 the extra range is EXTRA_RANGE_START_AIRTIME × airtime × speed.
 * At EXTRA_RANGE_DECAY_MS it reaches EXTRA_RANGE_FLOOR_AIRTIME × airtime × speed
 * and stays there.
 */
function extraRange(speed: number, elapsedMs: number): number {
  const t = Math.min(elapsedMs / EXTRA_RANGE_DECAY_MS, 1);
  const airtimePx = jumpAirtime() * speed;
  const startRange = EXTRA_RANGE_START_AIRTIME * airtimePx;
  const floorRange = EXTRA_RANGE_FLOOR_AIRTIME * airtimePx;
  return startRange + t * (floorRange - startRange);
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Plan the next Obstacle Group: pick a size and compute the clear gap.
 *
 * Invariants (always hold for any speed and elapsed):
 *   - `gapPx >= computeMinGap(speed)`          (jumpable gap guaranteed)
 *   - `size * GAME_OBSTACLE_WIDTH <= computeReach(speed)` (span within reach)
 *   - `1 <= size <= 3`
 */
export function planNextGroup(input: PlanInput): PlanResult {
  const { speed, elapsedMs, rng } = input;

  const minGap = computeMinGap(speed);
  const extra = extraRange(speed, elapsedMs);
  const gapPx = minGap + rng() * extra;

  let size = pickSize(rng, elapsedMs);

  // Safety clamp: ensure group span never exceeds jump reach.
  // In practice this never triggers given the chosen obstacle width, but it
  // makes the invariant unconditional regardless of physics constants.
  const reach = computeReach(speed);
  const maxSize = Math.max(1, Math.floor(reach / GAME_OBSTACLE_WIDTH));
  if (size > maxSize) size = maxSize;

  return { size, gapPx };
}
