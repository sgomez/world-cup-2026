import combinationsData from "../../data/worldcup.combinations.json";
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

// null team2 = third-place slot resolved via combinations table
const R32_MATCHUPS: Array<{
  num: number;
  team1: string;
  team2: string | null;
}> = [
  { num: 73, team1: "2A", team2: "2B" },
  { num: 74, team1: "1E", team2: null },
  { num: 75, team1: "1F", team2: "2C" },
  { num: 76, team1: "1C", team2: "2F" },
  { num: 77, team1: "1I", team2: null },
  { num: 78, team1: "2E", team2: "2I" },
  { num: 79, team1: "1A", team2: null },
  { num: 80, team1: "1L", team2: null },
  { num: 81, team1: "1D", team2: null },
  { num: 82, team1: "1G", team2: null },
  { num: 83, team1: "2K", team2: "2L" },
  { num: 84, team1: "1H", team2: "2J" },
  { num: 85, team1: "1B", team2: null },
  { num: 86, team1: "1J", team2: "2H" },
  { num: 87, team1: "1K", team2: null },
  { num: 88, team1: "2D", team2: "2G" },
];

// Derived from worldcup.json W-references
const matchProgression: Record<string, { nextMatch: string; slot: 1 | 2 }> = {
  "R32-74": { nextMatch: "R16-89", slot: 1 },
  "R32-77": { nextMatch: "R16-89", slot: 2 },
  "R32-73": { nextMatch: "R16-90", slot: 1 },
  "R32-75": { nextMatch: "R16-90", slot: 2 },
  "R32-76": { nextMatch: "R16-91", slot: 1 },
  "R32-78": { nextMatch: "R16-91", slot: 2 },
  "R32-79": { nextMatch: "R16-92", slot: 1 },
  "R32-80": { nextMatch: "R16-92", slot: 2 },
  "R32-83": { nextMatch: "R16-93", slot: 1 },
  "R32-84": { nextMatch: "R16-93", slot: 2 },
  "R32-81": { nextMatch: "R16-94", slot: 1 },
  "R32-82": { nextMatch: "R16-94", slot: 2 },
  "R32-86": { nextMatch: "R16-95", slot: 1 },
  "R32-88": { nextMatch: "R16-95", slot: 2 },
  "R32-85": { nextMatch: "R16-96", slot: 1 },
  "R32-87": { nextMatch: "R16-96", slot: 2 },
  "R16-89": { nextMatch: "QF-97", slot: 1 },
  "R16-90": { nextMatch: "QF-97", slot: 2 },
  "R16-93": { nextMatch: "QF-98", slot: 1 },
  "R16-94": { nextMatch: "QF-98", slot: 2 },
  "R16-91": { nextMatch: "QF-99", slot: 1 },
  "R16-92": { nextMatch: "QF-99", slot: 2 },
  "R16-95": { nextMatch: "QF-100", slot: 1 },
  "R16-96": { nextMatch: "QF-100", slot: 2 },
  "QF-97": { nextMatch: "SF-101", slot: 1 },
  "QF-98": { nextMatch: "SF-101", slot: 2 },
  "QF-99": { nextMatch: "SF-102", slot: 1 },
  "QF-100": { nextMatch: "SF-102", slot: 2 },
  "SF-101": { nextMatch: "F", slot: 1 },
  "SF-102": { nextMatch: "F", slot: 2 },
};

const thirdPlaceProgression: Record<string, { slot: 1 | 2 }> = {
  "SF-101": { slot: 1 },
  "SF-102": { slot: 2 },
};

export const KNOCKOUT_MATCH_IDS: Record<KnockoutRound, string[]> = {
  R32: [73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88].map(
    (n) => `R32-${n}`,
  ),
  R16: [89, 90, 91, 92, 93, 94, 95, 96].map((n) => `R16-${n}`),
  QF: [97, 98, 99, 100].map((n) => `QF-${n}`),
  SF: ["SF-101", "SF-102"],
  "3RD": ["3RD"],
  F: ["F"],
};

function getTeamIdFromPosition(
  positionCode: string,
  groupOrders: GroupOrders,
): string | null {
  const position = parseInt(positionCode[0], 10) - 1;
  const groupName = positionCode.slice(1);
  return groupOrders[groupName]?.[position] ?? null;
}

export function computeR32Matches(
  groupOrders: GroupOrders,
  thirdPlaceOrder: ThirdPlaceOrder,
  combinations: Record<string, Record<string, string>>,
): Record<string, KnockoutMatch> {
  const top8Letters = thirdPlaceOrder.slice(0, 8).map((id) => id.split("-")[1]);
  const combinationKey = [...top8Letters].sort().join("");
  const combinationMap = combinations[combinationKey] ?? {};

  const matches: Record<string, KnockoutMatch> = {};
  for (const { num, team1, team2 } of R32_MATCHUPS) {
    const matchId = `R32-${num}`;
    const team1Id = getTeamIdFromPosition(team1, groupOrders);

    let team2Id: string | null;
    if (team2 === null) {
      // Third-place slot: resolve via combinations
      const lookupKey = `${team1[0]}${team1.slice(1).toLowerCase()}`; // "1E" → "1e"
      const thirdSlot = combinationMap[lookupKey]; // e.g. "3f"
      if (thirdSlot) {
        const groupLetter = thirdSlot[1].toUpperCase(); // "3f" → "F"
        team2Id = groupOrders[groupLetter]?.[2] ?? null;
      } else {
        team2Id = null;
      }
    } else {
      team2Id = getTeamIdFromPosition(team2, groupOrders);
    }

    matches[matchId] = {
      id: matchId,
      round: "R32",
      team1Id,
      team2Id,
      winnerId: null,
      loserId: null,
    };
  }
  return matches;
}

function createEmptyKnockoutMatches(): Record<string, KnockoutMatch> {
  const matches: Record<string, KnockoutMatch> = {};
  for (const [round, ids] of Object.entries(KNOCKOUT_MATCH_IDS)) {
    for (const id of ids) {
      matches[id] = {
        id,
        round: round as KnockoutRound,
        team1Id: null,
        team2Id: null,
        winnerId: null,
        loserId: null,
      };
    }
  }
  return matches;
}

function applyWinnerToMatches(
  matches: Record<string, KnockoutMatch>,
  matchId: string,
  winnerId: string,
): Record<string, KnockoutMatch> {
  const match = matches[matchId];
  if (!match) return matches;
  const loserId = match.team1Id === winnerId ? match.team2Id : match.team1Id;
  let newMatches = {
    ...matches,
    [matchId]: { ...match, winnerId, loserId },
  };
  const prog = matchProgression[matchId];
  if (prog) {
    const next = newMatches[prog.nextMatch];
    if (next) {
      newMatches = {
        ...newMatches,
        [prog.nextMatch]: {
          ...next,
          [prog.slot === 1 ? "team1Id" : "team2Id"]: winnerId,
        },
      };
    }
  }
  const third = thirdPlaceProgression[matchId];
  if (third && loserId) {
    const t = newMatches["3RD"];
    if (t) {
      newMatches = {
        ...newMatches,
        "3RD": {
          ...t,
          [third.slot === 1 ? "team1Id" : "team2Id"]: loserId,
        },
      };
    }
  }
  return newMatches;
}

function cascadeClearWinner(
  matches: Record<string, KnockoutMatch>,
  matchId: string,
): Record<string, KnockoutMatch> {
  const match = matches[matchId];
  if (!match?.winnerId) return matches;

  const clearedWinnerId = match.winnerId;
  const clearedLoserId = match.loserId;

  let newMatches = {
    ...matches,
    [matchId]: { ...match, winnerId: null, loserId: null },
  };

  const prog = matchProgression[matchId];
  if (prog) {
    const next = newMatches[prog.nextMatch];
    if (next) {
      const slotKey = prog.slot === 1 ? "team1Id" : "team2Id";
      if (next[slotKey] === clearedWinnerId) {
        newMatches = {
          ...newMatches,
          [prog.nextMatch]: { ...next, [slotKey]: null },
        };
        if (next.winnerId === clearedWinnerId) {
          newMatches = cascadeClearWinner(newMatches, prog.nextMatch);
        }
      }
    }
  }

  const third = thirdPlaceProgression[matchId];
  if (third && clearedLoserId) {
    const t = newMatches["3RD"];
    if (t) {
      const slotKey = third.slot === 1 ? "team1Id" : "team2Id";
      if (t[slotKey] === clearedLoserId) {
        newMatches = {
          ...newMatches,
          "3RD": {
            ...t,
            [slotKey]: null,
            winnerId: t.winnerId === clearedLoserId ? null : t.winnerId,
            loserId: t.loserId === clearedLoserId ? null : t.loserId,
          },
        };
      }
    }
  }

  return newMatches;
}

function mergeR32WithCascade(
  currentMatches: Record<string, KnockoutMatch>,
  newR32: Record<string, KnockoutMatch>,
): Record<string, KnockoutMatch> {
  let matches = { ...currentMatches };
  for (const [matchId, newMatch] of Object.entries(newR32)) {
    const current = matches[matchId];
    if (!current) {
      matches = { ...matches, [matchId]: newMatch };
      continue;
    }
    matches = {
      ...matches,
      [matchId]: {
        ...current,
        team1Id: newMatch.team1Id,
        team2Id: newMatch.team2Id,
      },
    };
    if (
      current.winnerId !== null &&
      current.winnerId !== newMatch.team1Id &&
      current.winnerId !== newMatch.team2Id
    ) {
      matches = cascadeClearWinner(matches, matchId);
    }
  }
  return matches;
}

const ROUND_ORDER: KnockoutRound[] = ["R32", "R16", "QF", "SF", "3RD", "F"];

export function createInitialState(
  saved: PredictionState | null,
  knockoutWinners?: Record<string, string> | null,
): TournamentState {
  const groupOrders =
    saved?.groupOrders ??
    Object.fromEntries(groups.map((g) => [g.group, g.teams.map((t) => t.id)]));
  const thirdPlaceOrder =
    saved?.thirdPlaceOrder ?? groups.map((g) => `3rd-${g.group.toLowerCase()}`);

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
