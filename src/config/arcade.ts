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
