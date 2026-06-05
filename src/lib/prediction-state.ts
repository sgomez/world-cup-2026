import { groups } from "./teams";

export type GroupOrders = Record<string, string[]>;
export type ThirdPlaceOrder = string[];

export type PredictionState = {
  groupOrders: GroupOrders;
  thirdPlaceOrder: ThirdPlaceOrder;
};

export type KnockoutRound = "R32" | "R16" | "QF" | "SF" | "3RD" | "F";

export type KnockoutMatch = {
  id: string;
  round: KnockoutRound;
  team1Id: string | null;
  team2Id: string | null;
  winnerId: string | null;
  loserId: string | null;
};

export type TournamentState = PredictionState & {
  knockoutMatches: Record<string, KnockoutMatch>;
};

export type TournamentAction =
  | { type: "SET_GROUP_ORDER"; groupName: string; orderedIds: string[] }
  | { type: "SET_THIRD_PLACE_ORDER"; orderedIds: string[] }
  | { type: "SET_KNOCKOUT_WINNER"; matchId: string; winnerId: string }
  | { type: "CLEAR_KNOCKOUT_WINNER"; matchId: string };

export type PredictionAction = TournamentAction;

const R32_MATCHUPS: Array<{ match: number; team1: string; team2: string }> = [
  { match: 1, team1: "1A", team2: "3rd-1" },
  { match: 2, team1: "1B", team2: "3rd-2" },
  { match: 3, team1: "1C", team2: "3rd-3" },
  { match: 4, team1: "1D", team2: "3rd-4" },
  { match: 5, team1: "1E", team2: "3rd-5" },
  { match: 6, team1: "1F", team2: "3rd-6" },
  { match: 7, team1: "1G", team2: "3rd-7" },
  { match: 8, team1: "1H", team2: "3rd-8" },
  { match: 9, team1: "1I", team2: "2L" },
  { match: 10, team1: "1J", team2: "2K" },
  { match: 11, team1: "1K", team2: "2J" },
  { match: 12, team1: "1L", team2: "2I" },
  { match: 13, team1: "2A", team2: "2D" },
  { match: 14, team1: "2B", team2: "2C" },
  { match: 15, team1: "2E", team2: "2H" },
  { match: 16, team1: "2F", team2: "2G" },
];

function getTeamIdFromPosition(
  positionCode: string,
  groupOrders: GroupOrders,
  thirdPlaceOrder: ThirdPlaceOrder,
): string | null {
  if (positionCode.startsWith("3rd-")) {
    const rank = parseInt(positionCode.split("-")[1]) - 1;
    const slotId = thirdPlaceOrder[rank];
    if (!slotId) return null;
    const groupName = slotId.split("-")[1].toUpperCase();
    return groupOrders[groupName]?.[2] ?? null;
  }
  const position = parseInt(positionCode[0]) - 1;
  const groupName = positionCode.slice(1);
  return groupOrders[groupName]?.[position] ?? null;
}

export function computeR32Matches(
  groupOrders: GroupOrders,
  thirdPlaceOrder: ThirdPlaceOrder,
): Record<string, KnockoutMatch> {
  const matches: Record<string, KnockoutMatch> = {};
  for (const { match, team1, team2 } of R32_MATCHUPS) {
    const matchId = `R32-${match}`;
    matches[matchId] = {
      id: matchId,
      round: "R32",
      team1Id: getTeamIdFromPosition(team1, groupOrders, thirdPlaceOrder),
      team2Id: getTeamIdFromPosition(team2, groupOrders, thirdPlaceOrder),
      winnerId: null,
      loserId: null,
    };
  }
  return matches;
}

function createEmptyKnockoutMatches(): Record<string, KnockoutMatch> {
  const matches: Record<string, KnockoutMatch> = {};
  for (let i = 1; i <= 16; i++)
    matches[`R32-${i}`] = {
      id: `R32-${i}`,
      round: "R32",
      team1Id: null,
      team2Id: null,
      winnerId: null,
      loserId: null,
    };
  for (let i = 1; i <= 8; i++)
    matches[`R16-${i}`] = {
      id: `R16-${i}`,
      round: "R16",
      team1Id: null,
      team2Id: null,
      winnerId: null,
      loserId: null,
    };
  for (let i = 1; i <= 4; i++)
    matches[`QF-${i}`] = {
      id: `QF-${i}`,
      round: "QF",
      team1Id: null,
      team2Id: null,
      winnerId: null,
      loserId: null,
    };
  for (let i = 1; i <= 2; i++)
    matches[`SF-${i}`] = {
      id: `SF-${i}`,
      round: "SF",
      team1Id: null,
      team2Id: null,
      winnerId: null,
      loserId: null,
    };
  matches["3RD-1"] = {
    id: "3RD-1",
    round: "3RD",
    team1Id: null,
    team2Id: null,
    winnerId: null,
    loserId: null,
  };
  matches["F-1"] = {
    id: "F-1",
    round: "F",
    team1Id: null,
    team2Id: null,
    winnerId: null,
    loserId: null,
  };
  return matches;
}

const matchProgression: Record<string, { nextMatch: string; slot: 1 | 2 }> = {
  "R32-1": { nextMatch: "R16-1", slot: 1 },
  "R32-2": { nextMatch: "R16-1", slot: 2 },
  "R32-3": { nextMatch: "R16-2", slot: 1 },
  "R32-4": { nextMatch: "R16-2", slot: 2 },
  "R32-5": { nextMatch: "R16-3", slot: 1 },
  "R32-6": { nextMatch: "R16-3", slot: 2 },
  "R32-7": { nextMatch: "R16-4", slot: 1 },
  "R32-8": { nextMatch: "R16-4", slot: 2 },
  "R32-9": { nextMatch: "R16-5", slot: 1 },
  "R32-10": { nextMatch: "R16-5", slot: 2 },
  "R32-11": { nextMatch: "R16-6", slot: 1 },
  "R32-12": { nextMatch: "R16-6", slot: 2 },
  "R32-13": { nextMatch: "R16-7", slot: 1 },
  "R32-14": { nextMatch: "R16-7", slot: 2 },
  "R32-15": { nextMatch: "R16-8", slot: 1 },
  "R32-16": { nextMatch: "R16-8", slot: 2 },
  "R16-1": { nextMatch: "QF-1", slot: 1 },
  "R16-2": { nextMatch: "QF-1", slot: 2 },
  "R16-3": { nextMatch: "QF-2", slot: 1 },
  "R16-4": { nextMatch: "QF-2", slot: 2 },
  "R16-5": { nextMatch: "QF-3", slot: 1 },
  "R16-6": { nextMatch: "QF-3", slot: 2 },
  "R16-7": { nextMatch: "QF-4", slot: 1 },
  "R16-8": { nextMatch: "QF-4", slot: 2 },
  "QF-1": { nextMatch: "SF-1", slot: 1 },
  "QF-2": { nextMatch: "SF-1", slot: 2 },
  "QF-3": { nextMatch: "SF-2", slot: 1 },
  "QF-4": { nextMatch: "SF-2", slot: 2 },
  "SF-1": { nextMatch: "F-1", slot: 1 },
  "SF-2": { nextMatch: "F-1", slot: 2 },
};

const thirdPlaceProgression: Record<string, { slot: 1 | 2 }> = {
  "SF-1": { slot: 1 },
  "SF-2": { slot: 2 },
};

export function createInitialState(
  saved: PredictionState | null,
): TournamentState {
  const groupOrders =
    saved?.groupOrders ??
    Object.fromEntries(groups.map((g) => [g.group, g.teams.map((t) => t.id)]));
  const thirdPlaceOrder =
    saved?.thirdPlaceOrder ?? groups.map((g) => `3rd-${g.group.toLowerCase()}`);
  return {
    groupOrders,
    thirdPlaceOrder,
    knockoutMatches: {
      ...createEmptyKnockoutMatches(),
      ...computeR32Matches(groupOrders, thirdPlaceOrder),
    },
  };
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
      const r32 = computeR32Matches(newGroupOrders, state.thirdPlaceOrder);
      return {
        ...state,
        groupOrders: newGroupOrders,
        knockoutMatches: { ...state.knockoutMatches, ...r32 },
      };
    }
    case "SET_THIRD_PLACE_ORDER": {
      const r32 = computeR32Matches(state.groupOrders, action.orderedIds);
      return {
        ...state,
        thirdPlaceOrder: action.orderedIds,
        knockoutMatches: { ...state.knockoutMatches, ...r32 },
      };
    }
    case "SET_KNOCKOUT_WINNER": {
      const match = state.knockoutMatches[action.matchId];
      if (!match) return state;
      const loserId =
        match.team1Id === action.winnerId ? match.team2Id : match.team1Id;
      let newMatches = {
        ...state.knockoutMatches,
        [action.matchId]: { ...match, winnerId: action.winnerId, loserId },
      };
      const prog = matchProgression[action.matchId];
      if (prog) {
        const next = newMatches[prog.nextMatch];
        newMatches = {
          ...newMatches,
          [prog.nextMatch]: {
            ...next,
            [prog.slot === 1 ? "team1Id" : "team2Id"]: action.winnerId,
          },
        };
      }
      const third = thirdPlaceProgression[action.matchId];
      if (third && loserId) {
        const t = newMatches["3RD-1"];
        newMatches = {
          ...newMatches,
          "3RD-1": {
            ...t,
            [third.slot === 1 ? "team1Id" : "team2Id"]: loserId,
          },
        };
      }
      return { ...state, knockoutMatches: newMatches };
    }
    case "CLEAR_KNOCKOUT_WINNER": {
      const match = state.knockoutMatches[action.matchId];
      if (!match) return state;
      let newMatches = {
        ...state.knockoutMatches,
        [action.matchId]: { ...match, winnerId: null, loserId: null },
      };
      const prog = matchProgression[action.matchId];
      if (prog && match.winnerId) {
        const next = newMatches[prog.nextMatch];
        newMatches = {
          ...newMatches,
          [prog.nextMatch]: {
            ...next,
            [prog.slot === 1 ? "team1Id" : "team2Id"]: null,
            winnerId: next.winnerId === match.winnerId ? null : next.winnerId,
            loserId: next.winnerId === match.winnerId ? null : next.loserId,
          },
        };
      }
      const third = thirdPlaceProgression[action.matchId];
      if (third && match.loserId) {
        const t = newMatches["3RD-1"];
        newMatches = {
          ...newMatches,
          "3RD-1": {
            ...t,
            [third.slot === 1 ? "team1Id" : "team2Id"]: null,
            winnerId: t.winnerId === match.loserId ? null : t.winnerId,
            loserId: t.loserId === match.loserId ? null : t.loserId,
          },
        };
      }
      return { ...state, knockoutMatches: newMatches };
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
  groupName: string;
};

export function getThirdPlaceTeams(state: TournamentState): ThirdPlaceTeam[] {
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
  state: TournamentState,
): ThirdPlaceTeam[] {
  const all = getThirdPlaceTeams(state);
  const byId = new Map(all.map((t) => [t.id, t]));
  const valid = state.thirdPlaceOrder.filter((id) => byId.has(id));
  const newEntries = all.filter((t) => !state.thirdPlaceOrder.includes(t.id));
  return [...valid.map((id) => byId.get(id) as ThirdPlaceTeam), ...newEntries];
}

export function getAllTeamsLookup(): Map<
  string,
  { id: string; name: string; flag: string }
> {
  const lookup = new Map<string, { id: string; name: string; flag: string }>();
  for (const group of groups) {
    for (const team of group.teams) {
      lookup.set(team.id, team);
    }
  }
  return lookup;
}

export function getTeamsInRound(
  state: TournamentState,
  round: KnockoutRound,
): { id: string; name: string; flag: string }[] {
  const lookup = getAllTeamsLookup();
  const ids = new Set<string>();
  for (const match of Object.values(state.knockoutMatches)) {
    if (match.round !== round) continue;
    if (match.team1Id) ids.add(match.team1Id);
    if (match.team2Id) ids.add(match.team2Id);
  }
  return Array.from(ids)
    .map((id) => lookup.get(id))
    .filter(
      (t): t is { id: string; name: string; flag: string } => t !== undefined,
    );
}
