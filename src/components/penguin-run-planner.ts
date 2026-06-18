/**
 * Penguin Run — pure Obstacle-Group planner (ADR 0035).
 *
 * `planNextGroup` is the single entry point. It is a pure function with an
 * injectable RNG so the "always jumpable" invariant can be verified in tests
 * without a canvas or `Math.random`.
 *
 * All tunable constants are in `src/config/arcade.ts`.
 */

import {
  GAME_EXTRA_RANGE_DECAY_MS,
  GAME_EXTRA_RANGE_FLOOR_AIRTIME,
  GAME_EXTRA_RANGE_START_AIRTIME,
  GAME_GRAVITY,
  GAME_JUMP_VELOCITY,
  GAME_MIN_GAP_SAFETY,
  GAME_OBSTACLE_WIDTH,
  GAME_SIZE_WEIGHT_TRANSITION_MS,
  GAME_SIZE_WEIGHTS_EARLY,
  GAME_SIZE_WEIGHTS_LATE,
} from "@/config/arcade";

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/** airtime of a jump at constant gravity (seconds). */
function jumpAirtime(): number {
  return (2 * Math.abs(GAME_JUMP_VELOCITY)) / GAME_GRAVITY;
}

/**
 * Minimum safe gap (px) between the trailing edge of one Obstacle Group and
 * the leading edge of the next, given the current scroll speed.
 *
 * Guarantees a land-and-rejump window at any speed.
 */
export function computeMinGap(scrollSpeed: number): number {
  return scrollSpeed * jumpAirtime() * GAME_MIN_GAP_SAFETY;
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
  const t = Math.min(elapsedMs / GAME_SIZE_WEIGHT_TRANSITION_MS, 1);
  return [
    GAME_SIZE_WEIGHTS_EARLY[0] +
      t * (GAME_SIZE_WEIGHTS_LATE[0] - GAME_SIZE_WEIGHTS_EARLY[0]),
    GAME_SIZE_WEIGHTS_EARLY[1] +
      t * (GAME_SIZE_WEIGHTS_LATE[1] - GAME_SIZE_WEIGHTS_EARLY[1]),
    GAME_SIZE_WEIGHTS_EARLY[2] +
      t * (GAME_SIZE_WEIGHTS_LATE[2] - GAME_SIZE_WEIGHTS_EARLY[2]),
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
  const t = Math.min(elapsedMs / GAME_EXTRA_RANGE_DECAY_MS, 1);
  const airtimePx = jumpAirtime() * speed;
  const startRange = GAME_EXTRA_RANGE_START_AIRTIME * airtimePx;
  const floorRange = GAME_EXTRA_RANGE_FLOOR_AIRTIME * airtimePx;
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
