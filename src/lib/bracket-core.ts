// Shim: re-exports from the canonical Bracket module.
// All callers should migrate to importing from "@/modules/bracket" directly.
export type {
  GroupOrders,
  KnockoutMatch,
  KnockoutRound,
  PredictionState,
  ThirdPlaceOrder,
  TournamentState,
} from "@/modules/bracket";

export {
  applyWinnerToMatches,
  cascadeClearWinner,
  computeR32Matches,
  createEmptyKnockoutMatches,
  extractWinners,
  getTeamIdFromPosition,
  KNOCKOUT_MATCH_IDS,
  matchProgression,
  R32_MATCHUPS,
  ROUND_ORDER,
  rebuildKnockoutMatches,
  thirdPlaceProgression,
} from "@/modules/bracket";
