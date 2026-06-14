import type { MatchPhase } from "./live-feed";

/**
 * Phase ceilings in minutes.
 * A first-half display minute never advances past 45.
 * A second-half minute never advances past 90.
 * Extra time never advances past 120.
 * Penalties and finished phases have no minute display.
 */
const PHASE_CEILING: Partial<Record<MatchPhase, number>> = {
  first_half: 45,
  second_half: 90,
  extra_time: 120,
};

/**
 * Format the estimated display minute string.
 *
 * Rules:
 * - "penalties" → no minute shown (null)
 * - "finished"  → no minute shown (null)
 * - "not_started" → "0'"
 * - Clamped at phase ceiling; if at ceiling → show "45+" / "90+" / "120+" (stoppage)
 * - Otherwise → show plain minute e.g. "32'"
 * - inStoppage flag from the feed → show "N+" marker regardless
 *
 * @param phase - Current match phase
 * @param storedMinute - Minute persisted from last feed write (nullable)
 * @param inStoppage - Whether the feed reported stoppage time
 * @param updatedAt - When the live result was last written (for estimation)
 * @param now - Current time for estimation
 */
export function estimateLiveMinute(
  phase: MatchPhase | null | undefined,
  storedMinute: number | null | undefined,
  inStoppage: boolean | null | undefined,
  updatedAt: Date | undefined,
  now: Date,
): string | null {
  if (!phase || phase === "finished" || phase === "penalties") {
    return null;
  }

  if (phase === "not_started") {
    return "0'";
  }

  const ceiling = PHASE_CEILING[phase];
  if (ceiling === undefined) {
    // Unknown phase — no display
    return null;
  }

  // Base minute: stored value or 0
  const base = storedMinute ?? 0;

  // Elapsed seconds since the last write
  const elapsedSeconds = updatedAt
    ? Math.max(0, now.getTime() - updatedAt.getTime()) / 1000
    : 0;
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);

  const estimated = base + elapsedMinutes;
  const clamped = Math.min(estimated, ceiling);

  const atOrPastCeiling = estimated >= ceiling || inStoppage;
  if (atOrPastCeiling) {
    return `${ceiling}+`;
  }
  return `${clamped}'`;
}
