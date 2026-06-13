import { getGroups } from "@/modules/teams";
import combinationsData from "../../../data/worldcup.combinations.json";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Round constants
// ---------------------------------------------------------------------------

export const ROUND_ORDER: KnockoutRound[] = [
  "R32",
  "R16",
  "QF",
  "SF",
  "3RD",
  "F",
];

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

// ---------------------------------------------------------------------------
// Match tables (exported for shim compatibility; not part of the core interface)
// ---------------------------------------------------------------------------

// null team2 = third-place slot resolved via combinations table
export const R32_MATCHUPS: Array<{
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
export const matchProgression: Record<
  string,
  { nextMatch: string; slot: 1 | 2 }
> = {
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

export const thirdPlaceProgression: Record<string, { slot: 1 | 2 }> = {
  "SF-101": { slot: 1 },
  "SF-102": { slot: 2 },
};

// ---------------------------------------------------------------------------
// Core engine
// ---------------------------------------------------------------------------

export function getTeamIdFromPosition(
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

export function createEmptyKnockoutMatches(): Record<string, KnockoutMatch> {
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

export function applyWinnerToMatches(
  matches: Record<string, KnockoutMatch>,
  matchId: string,
  winnerId: string,
): Record<string, KnockoutMatch> {
  const match = matches[matchId];
  if (!match) return matches;

  let currentMatches = matches;
  if (match.winnerId && match.winnerId !== winnerId) {
    currentMatches = cascadeClearWinner(matches, matchId);
  }

  const updatedMatch = currentMatches[matchId] || match;
  const loserId =
    updatedMatch.team1Id === winnerId
      ? updatedMatch.team2Id
      : updatedMatch.team1Id;
  let newMatches = {
    ...currentMatches,
    [matchId]: { ...updatedMatch, winnerId, loserId },
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

export function cascadeClearWinner(
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
        } else if (next.loserId === clearedWinnerId) {
          newMatches = {
            ...newMatches,
            [prog.nextMatch]: {
              ...newMatches[prog.nextMatch],
              loserId: null,
            },
          };
          const nextThird = thirdPlaceProgression[prog.nextMatch];
          if (nextThird) {
            const t = newMatches["3RD"];
            if (t) {
              const thirdSlotKey = nextThird.slot === 1 ? "team1Id" : "team2Id";
              if (t[thirdSlotKey] === clearedWinnerId) {
                newMatches = {
                  ...newMatches,
                  "3RD": {
                    ...t,
                    [thirdSlotKey]: null,
                    winnerId:
                      t.winnerId === clearedWinnerId ? null : t.winnerId,
                    loserId: t.loserId === clearedWinnerId ? null : t.loserId,
                  },
                };
              }
            }
          }
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

export function extractWinners(
  knockoutMatches: Record<string, KnockoutMatch>,
): Record<string, string> {
  const winners: Record<string, string> = {};
  for (const [matchId, match] of Object.entries(knockoutMatches)) {
    if (match.winnerId) {
      winners[matchId] = match.winnerId;
    }
  }
  return winners;
}

export function rebuildKnockoutMatches(
  groupOrders: GroupOrders,
  thirdPlaceOrder: ThirdPlaceOrder,
  winners: Record<string, string>,
  combinations: Record<string, Record<string, string>>,
): Record<string, KnockoutMatch> {
  const r32 = computeR32Matches(groupOrders, thirdPlaceOrder, combinations);
  let knockoutMatches = { ...createEmptyKnockoutMatches(), ...r32 };

  const sorted = Object.entries(winners).sort(([aId], [bId]) => {
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

  return knockoutMatches;
}

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

/**
 * Returns the bracket reference placeholder code for an unresolved slot.
 * Examples: "W101", "L101", "2A", "3ABCD", etc.
 */
export function placeholderCodeForSlot(slotId: string, side: 1 | 2): string {
  if (slotId.startsWith("R32-")) {
    const num = parseInt(slotId.replace("R32-", ""), 10);
    const matchup = R32_MATCHUPS.find((m) => m.num === num);
    if (matchup) {
      const ref = side === 1 ? matchup.team1 : matchup.team2;
      if (ref) return ref;
    }
    // If team2 is null (third-place slot) or it is a mock matchup:
    if (side === 2) {
      const thirdsMap: Record<number, string> = {
        74: "3A/B/C/D/F",
        77: "3C/D/F/G/H",
        79: "3C/E/F/H/I",
        80: "3E/H/I/J/K",
        81: "3B/E/F/I/J",
        82: "3A/E/H/I/J",
        85: "3E/F/G/I/J",
        87: "3D/E/I/J/L",
      };
      return thirdsMap[num] || "3ABCD";
    }
    return matchup?.team1 || "TBD";
  }

  // Reverse lookup matchProgression to see which match feeds this slot
  const entry = Object.entries(matchProgression).find(
    ([_, val]) => val.nextMatch === slotId && val.slot === side,
  );
  if (entry) {
    const sourceMatchId = entry[0];
    const sourceNum = sourceMatchId.split("-")[1];
    return `W${sourceNum}`;
  }

  if (slotId === "3RD") {
    return side === 1 ? "L101" : "L102";
  }
  if (slotId === "F") {
    return side === 1 ? "W101" : "W102";
  }

  return "TBD";
}
