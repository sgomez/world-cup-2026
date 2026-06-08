import combinationsData from "../../data/worldcup.combinations.json";
import {
  applyWinnerToMatches,
  cascadeClearWinner,
  computeR32Matches,
  createEmptyKnockoutMatches,
  type GroupOrders,
  KNOCKOUT_MATCH_IDS,
  type KnockoutMatch,
  type KnockoutRound,
  mergeR32WithCascade,
  type PredictionState,
  ROUND_ORDER,
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
  KNOCKOUT_MATCH_IDS,
  mergeR32WithCascade,
  ROUND_ORDER,
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

  const r32 = computeR32Matches(groupOrders, thirdPlaceOrder, combinationsData);
  let knockoutMatches = { ...createEmptyKnockoutMatches(), ...r32 };

  if (knockoutWinners) {
    const sorted = Object.entries(knockoutWinners).sort(([aId], [bId]) => {
      const aRound = aId.replace(/-\d+$/, "") as KnockoutRound;
      const bRound = bId.replace(/-\d+$/, "") as KnockoutRound;
      return ROUND_ORDER.indexOf(aRound) - ROUND_ORDER.indexOf(bRound);
    });
    for (const [matchId, winnerId] of sorted) {
      const match = knockoutMatches[matchId];
      if (match && (match.team1Id === winnerId || match.team2Id === winnerId)) {
        knockoutMatches = applyWinnerToMatches(
          knockoutMatches,
          matchId,
          winnerId,
        );
      }
    }
  }

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
      const newR32 = computeR32Matches(
        newGroupOrders,
        state.thirdPlaceOrder,
        combinationsData,
      );
      return {
        ...state,
        groupOrders: newGroupOrders,
        knockoutMatches: mergeR32WithCascade(state.knockoutMatches, newR32),
      };
    }
    case "SET_THIRD_PLACE_ORDER": {
      const newR32 = computeR32Matches(
        state.groupOrders,
        action.orderedIds,
        combinationsData,
      );
      return {
        ...state,
        thirdPlaceOrder: action.orderedIds,
        knockoutMatches: mergeR32WithCascade(state.knockoutMatches, newR32),
      };
    }
    case "SET_KNOCKOUT_WINNER": {
      const match = state.knockoutMatches[action.matchId];
      if (!match) return state;
      return {
        ...state,
        knockoutMatches: applyWinnerToMatches(
          state.knockoutMatches,
          action.matchId,
          action.winnerId,
        ),
      };
    }
    case "CLEAR_KNOCKOUT_WINNER": {
      const match = state.knockoutMatches[action.matchId];
      if (!match) return state;
      return {
        ...state,
        knockoutMatches: cascadeClearWinner(
          state.knockoutMatches,
          action.matchId,
        ),
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
