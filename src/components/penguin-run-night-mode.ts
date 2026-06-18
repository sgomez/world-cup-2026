/**
 * Pure helper: determines whether the play-box should render in night
 * (inverted/dark) palette at a given score.
 *
 * Ported from the Chrome dino model, rescaled for POINTS_PER_SECOND = 1.
 *
 * @param score    - Current HUD score (integer, ≥ 0).
 * @param interval - Points between each night window start (e.g. 150).
 * @param duration - Length of each night window in points (e.g. 35).
 * @returns true when the score falls inside a night window.
 *
 * Rule: `score >= interval && score % interval < duration`
 * Scores 0 … interval-1 are always day; night first opens at score === interval.
 */
export function isNightMode(
  score: number,
  interval: number,
  duration: number,
): boolean {
  return score >= interval && score % interval < duration;
}
