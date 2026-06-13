/**
 * Re-export shim — all scoring logic now lives in @/modules/score.
 * This file is kept for backwards compatibility with existing importers and
 * will be deleted in the follow-up slice once all call sites are migrated.
 */
export type {
  RoundBreakdown,
  ScoreableContent,
  ScoreableContentArrays,
  ScoreBreakdown,
  WinnerBreakdown,
} from "@/modules/score";
// Back-compat aliases — removed in follow-up slice
export {
  CHAMPION_POINTS,
  EMPTY_SCOREABLE_CONTENT_ARRAYS,
  extractScoreableContent,
  ROUND_POINTS,
  score,
  score as scoreBet,
  scoreBreakdown,
  scoreBreakdown as scoreBetBreakdown,
  THIRD_PLACE_POINTS,
  toScoreableContent,
  toScoreableContentArrays,
} from "@/modules/score";
