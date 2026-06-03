import type { PredictionState } from "@/app/actions/bets";
import { groups } from "./teams";

export type { PredictionState };

export type PredictionAction =
  | { type: "SET_GROUP_ORDER"; groupName: string; orderedIds: string[] }
  | { type: "SET_THIRD_PLACE_ORDER"; orderedIds: string[] };

export type ThirdPlaceTeam = {
  id: string;
  originalId: string;
  name: string;
  flag: string;
  groupName: string;
};

export function createInitialState(
  saved: PredictionState | null,
): PredictionState {
  if (saved) return saved;
  return {
    groupOrders: Object.fromEntries(
      groups.map((g) => [g.group, g.teams.map((t) => t.id)]),
    ),
    thirdPlaceOrder: groups.map((g) => `3rd-${g.group.toLowerCase()}`),
  };
}

export function predictionReducer(
  state: PredictionState,
  action: PredictionAction,
): PredictionState {
  switch (action.type) {
    case "SET_GROUP_ORDER":
      return {
        ...state,
        groupOrders: {
          ...state.groupOrders,
          [action.groupName]: action.orderedIds,
        },
      };
    case "SET_THIRD_PLACE_ORDER":
      return { ...state, thirdPlaceOrder: action.orderedIds };
    default:
      return state;
  }
}

function getThirdPlaceTeams(state: PredictionState): ThirdPlaceTeam[] {
  return groups.map((group) => {
    const orderedIds =
      state.groupOrders[group.group] ?? group.teams.map((t) => t.id);
    const thirdId = orderedIds[2];
    const team = group.teams.find((t) => t.id === thirdId) ?? group.teams[2];
    return {
      id: `3rd-${group.group.toLowerCase()}`,
      originalId: team.id,
      name: team.name,
      flag: team.flag,
      groupName: group.group,
    };
  });
}

export function getOrderedThirdPlaceTeams(
  state: PredictionState,
): ThirdPlaceTeam[] {
  const all = getThirdPlaceTeams(state);
  const byId = new Map(all.map((t) => [t.id, t]));
  const valid = state.thirdPlaceOrder.filter((id) => byId.has(id));
  const newEntries = all.filter((t) => !state.thirdPlaceOrder.includes(t.id));
  return [...valid.map((id) => byId.get(id) as ThirdPlaceTeam), ...newEntries];
}
