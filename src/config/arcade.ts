/**
 * Heartbeat lapse threshold for Penguin Run stale-run finalisation.
 *
 * If an in_progress run's `lastSeenAt` is older than this (in milliseconds),
 * `getArcadeRanking` will finalise it server-side with the best Round score
 * reached so far (ADR 0034).
 *
 * Default: 5 minutes.
 */
export const ARCADE_STALE_TOLERANCE_MS: number =
  Number.parseInt(process.env.ARCADE_STALE_TOLERANCE_MS ?? "", 10) ||
  5 * 60 * 1000;

/** Feature flag: Penguin Run game is playable. Default off until the game ships. */
export const ARCADE_GAME_ENABLED: boolean =
  process.env.ARCADE_GAME_ENABLED === "true";

// ---------------------------------------------------------------------------
// Penguin Run — physics
// ---------------------------------------------------------------------------

/** Penguin jump velocity (px/s, negative = up). */
export const GAME_JUMP_VELOCITY = -700;

/** Gravity (px/s²). */
export const GAME_GRAVITY = 1800;

// ---------------------------------------------------------------------------
// Penguin Run — speed ramp
// ---------------------------------------------------------------------------

/** Initial horizontal scroll speed (px/s). */
export const GAME_INITIAL_SPEED = 400;

/** Speed increase applied every GAME_RAMP_INTERVAL_MS (px/s). */
export const GAME_SPEED_RAMP = 40;

/** Maximum scroll speed cap (px/s). */
export const GAME_SPEED_CAP = 800;

/** Interval at which speed is ramped (ms). */
export const GAME_RAMP_INTERVAL_MS = 4_000;

// ---------------------------------------------------------------------------
// Penguin Run — obstacle spawn model (ADR 0035)
// ---------------------------------------------------------------------------

/**
 * Width of a single obstacle sprite as rendered on the canvas (px).
 * Used by the planner to compute group span vs. jump reach.
 */
export const GAME_OBSTACLE_WIDTH = 64;

/** Safety multiplier applied to the airtime-derived minimum gap. */
export const GAME_MIN_GAP_SAFETY = 1.3;

/** Extra (random) gap beyond minGap at the start of a round, in airtime seconds. */
export const GAME_EXTRA_RANGE_START_AIRTIME = 1.5;

/** Extra gap floor — obstacle frequency stops rising once it reaches this. */
export const GAME_EXTRA_RANGE_FLOOR_AIRTIME = 0.2;

/** Elapsed ms at which extra-range shrinking reaches the floor. */
export const GAME_EXTRA_RANGE_DECAY_MS = 45_000;

/** Gap (px) between contiguous obstacles within the same group (0 = touching). */
export const GAME_OBSTACLE_GAP_WITHIN_GROUP = 0;

/**
 * Group-size weights [size-1, size-2, size-3] at the start of a round.
 * Interpolates toward GAME_SIZE_WEIGHTS_LATE over GAME_SIZE_WEIGHT_TRANSITION_MS.
 */
export const GAME_SIZE_WEIGHTS_EARLY: readonly [number, number, number] = [
  55, 35, 10,
];
export const GAME_SIZE_WEIGHTS_LATE: readonly [number, number, number] = [
  30, 40, 30,
];

/** Elapsed ms at which the size-weight distribution fully reaches LATE. */
export const GAME_SIZE_WEIGHT_TRANSITION_MS = 60_000;

// ---------------------------------------------------------------------------
// Penguin Run — rendering
// ---------------------------------------------------------------------------

/** Rendered height/width of the penguin sprite (px). */
export const GAME_SPRITE_SIZE = 48;

/**
 * Transparent padding (px, at dest scale) at the bottom of the penguin
 * sprite frames. Draw is shifted down by this so visual feet touch the ground.
 */
export const GAME_PENGUIN_DRAW_SINK = 16;

/**
 * Transparent padding (px, at dest scale) at the bottom of the obstacle sprite.
 * Baked into the spawn y so the visual base sits on the ground.
 */
export const GAME_OBS_FOOT_PAD = 12;

/** Ms per penguin walk animation frame (~11 fps). */
export const GAME_WALK_FRAME_MS = 91;

/** Height of the ground strip drawn at the bottom of the canvas (px). */
export const GAME_GROUND_HEIGHT = 8;

/** Penguin horizontal position as a fraction of canvas width. */
export const GAME_PENGUIN_X_FRACTION = 0.2;

/**
 * Forgiving hitbox fraction for both penguin and obstacle (ADR 0035).
 * Collision box = HITBOX_FRACTION × sprite size, centred on the sprite.
 */
export const GAME_HITBOX_FRACTION = 0.6;

/** Total rounds (lives) per run. */
export const GAME_TOTAL_ROUNDS = 3;
