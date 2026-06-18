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
// Penguin Run canvas game — tunable physics/speed constants
// ---------------------------------------------------------------------------

/** Initial horizontal scroll speed of snowmen (px/s). */
export const GAME_INITIAL_SPEED = 300;

/** Speed increase applied every GAME_RAMP_INTERVAL_MS (px/s). */
export const GAME_SPEED_RAMP = 20;

/** Maximum scroll speed cap (px/s). */
export const GAME_SPEED_CAP = 800;

/** Interval at which speed is ramped (ms). */
export const GAME_RAMP_INTERVAL_MS = 5_000;

/**
 * Width of a single obstacle sprite as rendered on the canvas (px).
 * Used by the obstacle-group planner to compute group span and assert
 * it stays within jump reach (ADR 0035).
 */
export const GAME_OBSTACLE_WIDTH = 48;
