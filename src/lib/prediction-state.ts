import combinationsData from "../../data/worldcup.combinations.json";
import {
  applyWinnerToMatches,
  cascadeClearWinner,
  computeR32Matches,
  createEmptyKnockoutMatches,
  extractWinners,
  type GroupOrders,
  KNOCKOUT_MATCH_IDS,
  type KnockoutMatch,
  type KnockoutRound,
  type PredictionState,
  ROUND_ORDER,
  rebuildKnockoutMatches,
  type ThirdPlaceOrder,
  type TournamentState,
} from "./bracket-core";
import { getGroups, type Team } from "./teams";

export type {
  GroupOrders,
  KnockoutMatch,
  KnockoutRound,
  PredictionState,
  ThirdPlaceOrder,
  TournamentState,
};

export {
  applyWinnerToMatches,
  cascadeClearWinner,
  computeR32Matches,
  createEmptyKnockoutMatches,
  extractWinners,
  KNOCKOUT_MATCH_IDS,
  ROUND_ORDER,
  rebuildKnockoutMatches,
};

export type TournamentAction =
  | { type: "SET_GROUP_ORDER"; groupName: string; orderedIds: string[] }
  | { type: "SET_THIRD_PLACE_ORDER"; orderedIds: string[] }
  | { type: "SET_KNOCKOUT_WINNER"; matchId: string; winnerId: string }
  | { type: "CLEAR_KNOCKOUT_WINNER"; matchId: string };

export type PredictionAction = TournamentAction;

export function createInitialState(
  saved: PredictionState | null,
  knockoutWinners?: Record<string, string> | null,
): TournamentState {
  const enGroups = getGroups("en");
  const groupOrders =
    saved?.groupOrders ??
    Object.fromEntries(
      enGroups.map((g) => [g.group, g.teams.map((t) => t.id)]),
    );
  const thirdPlaceOrder =
    saved?.thirdPlaceOrder ??
    enGroups.map((g) => `3rd-${g.group.toLowerCase()}`);

  const knockoutMatches = rebuildKnockoutMatches(
    groupOrders,
    thirdPlaceOrder,
    knockoutWinners ?? {},
    combinationsData,
  );

  return { groupOrders, thirdPlaceOrder, knockoutMatches };
}

export function tournamentReducer(
  state: TournamentState,
  action: TournamentAction,
): TournamentState {
  switch (action.type) {
    case "SET_GROUP_ORDER": {
      const newGroupOrders = {
        ...state.groupOrders,
        [action.groupName]: action.orderedIds,
      };
      const winners = extractWinners(state.knockoutMatches);
      const knockoutMatches = rebuildKnockoutMatches(
        newGroupOrders,
        state.thirdPlaceOrder,
        winners,
        combinationsData,
      );
      return {
        ...state,
        groupOrders: newGroupOrders,
        knockoutMatches,
      };
    }
    case "SET_THIRD_PLACE_ORDER": {
      const winners = extractWinners(state.knockoutMatches);
      const knockoutMatches = rebuildKnockoutMatches(
        state.groupOrders,
        action.orderedIds,
        winners,
        combinationsData,
      );
      return {
        ...state,
        thirdPlaceOrder: action.orderedIds,
        knockoutMatches,
      };
    }
    case "SET_KNOCKOUT_WINNER": {
      const match = state.knockoutMatches[action.matchId];
      if (!match) return state;
      const winners = extractWinners(state.knockoutMatches);
      const newWinners = {
        ...winners,
        [action.matchId]: action.winnerId,
      };
      const knockoutMatches = rebuildKnockoutMatches(
        state.groupOrders,
        state.thirdPlaceOrder,
        newWinners,
        combinationsData,
      );
      return {
        ...state,
        knockoutMatches,
      };
    }
    case "CLEAR_KNOCKOUT_WINNER": {
      const match = state.knockoutMatches[action.matchId];
      if (!match) return state;
      const winners = extractWinners(state.knockoutMatches);
      const newWinners = { ...winners };
      delete newWinners[action.matchId];
      const knockoutMatches = rebuildKnockoutMatches(
        state.groupOrders,
        state.thirdPlaceOrder,
        newWinners,
        combinationsData,
      );
      return {
        ...state,
        knockoutMatches,
      };
    }
    default:
      return state;
  }
}

export const predictionReducer = tournamentReducer;

export type ThirdPlaceTeam = {
  id: string;
  originalId: string;
  name: string;
  flag: string;
  code: string;
  groupName: string;
};

export function getThirdPlaceTeams(
  state: TournamentState,
  locale: string,
): ThirdPlaceTeam[] {
  return getGroups(locale).map((group) => {
    const orderedIds =
      state.groupOrders[group.group] ?? group.teams.map((t) => t.id);
    const thirdId = orderedIds[2];
    const team = group.teams.find((t) => t.id === thirdId) ?? group.teams[2];
    return {
      id: `3rd-${group.group.toLowerCase()}`,
      originalId: team.id,
      name: team.name,
      flag: team.flag,
      code: team.code,
      groupName: group.group,
    };
  });
}

export function getOrderedThirdPlaceTeams(
  state: TournamentState,
  locale: string,
): ThirdPlaceTeam[] {
  const all = getThirdPlaceTeams(state, locale);
  const byId = new Map(all.map((t) => [t.id, t]));
  const valid = state.thirdPlaceOrder.filter((id) => byId.has(id));
  const newEntries = all.filter((t) => !state.thirdPlaceOrder.includes(t.id));
  return [...valid.map((id) => byId.get(id) as ThirdPlaceTeam), ...newEntries];
}

const teamLookupByLocale: Record<string, Map<string, Team>> = {};

export function getAllTeamsLookup(locale: string): Map<string, Team> {
  if (teamLookupByLocale[locale]) return teamLookupByLocale[locale];
  const lookup = new Map<string, Team>();
  for (const group of getGroups(locale)) {
    for (const team of group.teams) {
      lookup.set(team.id, team);
    }
  }
  teamLookupByLocale[locale] = lookup;
  return lookup;
}

export function getTeamsInRound(
  state: TournamentState,
  round: KnockoutRound,
  locale: string,
): Team[] {
  const lookup = getAllTeamsLookup(locale);
  const ids = new Set<string>();
  for (const match of Object.values(state.knockoutMatches)) {
    if (match.round !== round) continue;
    if (match.team1Id) ids.add(match.team1Id);
    if (match.team2Id) ids.add(match.team2Id);
  }
  return Array.from(ids)
    .map((id) => lookup.get(id))
    .filter((t): t is Team => t !== undefined);
}
