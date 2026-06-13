/**
 * Backward-compatibility shim for @/lib/prediction-state.
 *
 * Core bracket engine → modules/bracket
 * Prediction UI (reducer, action types, locale helpers) → modules/bracket/prediction-ui
 *
 * Do not add new exports here. Import directly from the owning module instead.
 */

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
  createInitialState,
  extractWinners,
  KNOCKOUT_MATCH_IDS,
  ROUND_ORDER,
  rebuildKnockoutMatches,
} from "@/modules/bracket";

export type {
  PredictionAction,
  ThirdPlaceTeam,
  TournamentAction,
} from "@/modules/bracket/prediction-ui";

export {
  getAllTeamsLookup,
  getOrderedThirdPlaceTeams,
  getTeamsInRound,
  getThirdPlaceTeams,
  predictionReducer,
  tournamentReducer,
} from "@/modules/bracket/prediction-ui";
