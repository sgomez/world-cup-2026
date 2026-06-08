import { err, ok, type Result } from "neverthrow";
import {
  applyWinnerToMatches,
  computeR32Matches,
  createEmptyKnockoutMatches,
  type GroupOrders,
  getTeamIdFromPosition,
  type KnockoutMatch,
  type KnockoutRound,
  R32_MATCHUPS,
  ROUND_ORDER,
  type ThirdPlaceOrder,
} from "@/lib/bracket-core";
import { getGroups } from "@/lib/teams";
import combinationsData from "../../../../data/worldcup.combinations.json";
import { type DomainError, domainError } from "./errors";

export type TournamentResult = {
  groupOrders: GroupOrders;
  thirdPlaceOrder: ThirdPlaceOrder;
  knockoutWinners: Record<string, string>;
};

export type TournamentState = {
  id: string;
  result: TournamentResult | null;
  advancement: string[]; // Set of R32 references marked Advanced
  createdAt?: Date;
  updatedAt?: Date;
};

export const VALID_ADVANCEMENT_REFS = new Set([
  // Winners
  "1A",
  "1B",
  "1C",
  "1D",
  "1E",
  "1F",
  "1G",
  "1H",
  "1I",
  "1J",
  "1K",
  "1L",
  // Runners-up
  "2A",
  "2B",
  "2C",
  "2D",
  "2E",
  "2F",
  "2G",
  "2H",
  "2I",
  "2J",
  "2K",
  "2L",
  // Third-place slots
  "3rd-1A",
  "3rd-1B",
  "3rd-1D",
  "3rd-1E",
  "3rd-1G",
  "3rd-1I",
  "3rd-1K",
  "3rd-1L",
]);

export function getR32SlotOccupants(
  groupOrders: GroupOrders,
  thirdPlaceOrder: ThirdPlaceOrder,
  combinations: Record<string, Record<string, string>>,
): Record<string, string | null> {
  const occupants: Record<string, string | null> = {};

  const groups = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
  for (const g of groups) {
    occupants[`1${g}`] = groupOrders[g]?.[0] ?? null;
    occupants[`2${g}`] = groupOrders[g]?.[1] ?? null;
  }

  const top8Letters = thirdPlaceOrder.slice(0, 8).map((id) => id.split("-")[1]);
  const combinationKey = [...top8Letters].sort().join("");
  const combinationMap = combinations[combinationKey] ?? {};

  const thirdPlaceOpponents = ["1E", "1I", "1A", "1L", "1D", "1G", "1B", "1K"];
  for (const opponent of thirdPlaceOpponents) {
    const lookupKey = `${opponent[0]}${opponent.slice(1).toLowerCase()}`; // e.g. "1e"
    const thirdSlot = combinationMap[lookupKey]; // e.g. "3f"
    let teamId: string | null = null;
    if (thirdSlot) {
      const groupLetter = thirdSlot[1].toUpperCase(); // "F"
      teamId = groupOrders[groupLetter]?.[2] ?? null;
    }
    occupants[`3rd-${opponent}`] = teamId;
  }

  return occupants;
}

export function computeR32MatchesForTournament(
  groupOrders: GroupOrders,
  thirdPlaceOrder: ThirdPlaceOrder,
  combinations: Record<string, Record<string, string>>,
  advancement: string[],
): Record<string, KnockoutMatch> {
  const top8Letters = thirdPlaceOrder.slice(0, 8).map((id) => id.split("-")[1]);
  const combinationKey = [...top8Letters].sort().join("");
  const combinationMap = combinations[combinationKey] ?? {};

  const matches: Record<string, KnockoutMatch> = {};
  for (const { num, team1, team2 } of R32_MATCHUPS) {
    const matchId = `R32-${num}`;

    const isTeam1Advanced = advancement.includes(team1);
    const team1Id = isTeam1Advanced
      ? getTeamIdFromPosition(team1, groupOrders)
      : null;

    let team2Id: string | null = null;
    if (team2 === null) {
      const thirdRef = `3rd-${team1}`;
      const isTeam2Advanced = advancement.includes(thirdRef);
      if (isTeam2Advanced) {
        const lookupKey = `${team1[0]}${team1.slice(1).toLowerCase()}`; // "1E" → "1e"
        const thirdSlot = combinationMap[lookupKey];
        if (thirdSlot) {
          const groupLetter = thirdSlot[1].toUpperCase();
          team2Id = groupOrders[groupLetter]?.[2] ?? null;
        }
      }
    } else {
      const isTeam2Advanced = advancement.includes(team2);
      team2Id = isTeam2Advanced
        ? getTeamIdFromPosition(team2, groupOrders)
        : null;
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

export function computeTournamentBracket(
  result: TournamentResult,
  advancement: string[],
  combinations: Record<string, Record<string, string>>,
): Record<string, KnockoutMatch> {
  const r32 = computeR32MatchesForTournament(
    result.groupOrders,
    result.thirdPlaceOrder,
    combinations,
    advancement,
  );

  let knockoutMatches = { ...createEmptyKnockoutMatches(), ...r32 };

  const sorted = Object.entries(result.knockoutWinners).sort(([aId], [bId]) => {
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

export class Tournament {
  private constructor(private readonly state: TournamentState) {}

  static fromState(state: TournamentState): Tournament {
    return new Tournament({ ...state });
  }

  static createDefault(id: string = "singleton"): Tournament {
    return new Tournament({
      id,
      result: null,
      advancement: [],
    });
  }

  get id(): string {
    return this.state.id;
  }

  get result(): TournamentResult | null {
    return this.state.result;
  }

  get advancement(): string[] {
    return this.state.advancement;
  }

  get createdAt(): Date | undefined {
    return this.state.createdAt;
  }

  get updatedAt(): Date | undefined {
    return this.state.updatedAt;
  }

  toState(): TournamentState {
    return { ...this.state };
  }

  private getEffectiveResult(): TournamentResult {
    if (this.state.result) {
      return this.state.result;
    }
    const enGroups = getGroups("en");
    const groupOrders = Object.fromEntries(
      enGroups.map((g) => [g.group, g.teams.map((t) => t.id)]),
    );
    const thirdPlaceOrder = enGroups.map((g) => `3rd-${g.group.toLowerCase()}`);
    return {
      groupOrders,
      thirdPlaceOrder,
      knockoutWinners: {},
    };
  }

  setGroupOrder(
    group: string,
    orderedIds: string[],
  ): Result<Tournament, DomainError> {
    const currentResult = this.getEffectiveResult();
    const newGroupOrders = {
      ...currentResult.groupOrders,
      [group]: orderedIds,
    };

    // Calculate old slot occupants
    const oldOccupants = getR32SlotOccupants(
      currentResult.groupOrders,
      currentResult.thirdPlaceOrder,
      combinationsData,
    );

    // Calculate new slot occupants
    const newOccupants = getR32SlotOccupants(
      newGroupOrders,
      currentResult.thirdPlaceOrder,
      combinationsData,
    );

    // Cascade clear invalidated knockout winners
    // Run prediction style bracket computation to auto-clear stale winners
    const r32 = computeR32Matches(
      newGroupOrders,
      currentResult.thirdPlaceOrder,
      combinationsData,
    );
    let knockoutMatches = { ...createEmptyKnockoutMatches(), ...r32 };
    const sorted = Object.entries(currentResult.knockoutWinners).sort(
      ([aId], [bId]) => {
        const aRound = aId.replace(/-\d+$/, "") as KnockoutRound;
        const bRound = bId.replace(/-\d+$/, "") as KnockoutRound;
        return ROUND_ORDER.indexOf(aRound) - ROUND_ORDER.indexOf(bRound);
      },
    );
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

    const newKnockoutWinners: Record<string, string> = {};
    for (const [matchId, match] of Object.entries(knockoutMatches)) {
      if (match.winnerId) {
        newKnockoutWinners[matchId] = match.winnerId;
      }
    }

    // Clear advancement flags for any slot whose occupant changed
    const newAdvancement = this.state.advancement.filter((ref) => {
      const oldOccupant = oldOccupants[ref];
      const newOccupant = newOccupants[ref];
      return oldOccupant === newOccupant && oldOccupant !== null;
    });

    return ok(
      new Tournament({
        ...this.state,
        result: {
          groupOrders: newGroupOrders,
          thirdPlaceOrder: currentResult.thirdPlaceOrder,
          knockoutWinners: newKnockoutWinners,
        },
        advancement: newAdvancement,
      }),
    );
  }

  setThirdPlaceOrder(orderedIds: string[]): Result<Tournament, DomainError> {
    const currentResult = this.getEffectiveResult();

    // Calculate old slot occupants
    const oldOccupants = getR32SlotOccupants(
      currentResult.groupOrders,
      currentResult.thirdPlaceOrder,
      combinationsData,
    );

    // Calculate new slot occupants
    const newOccupants = getR32SlotOccupants(
      currentResult.groupOrders,
      orderedIds,
      combinationsData,
    );

    // Cascade clear invalidated knockout winners
    const r32 = computeR32Matches(
      currentResult.groupOrders,
      orderedIds,
      combinationsData,
    );
    let knockoutMatches = { ...createEmptyKnockoutMatches(), ...r32 };
    const sorted = Object.entries(currentResult.knockoutWinners).sort(
      ([aId], [bId]) => {
        const aRound = aId.replace(/-\d+$/, "") as KnockoutRound;
        const bRound = bId.replace(/-\d+$/, "") as KnockoutRound;
        return ROUND_ORDER.indexOf(aRound) - ROUND_ORDER.indexOf(bRound);
      },
    );
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

    const newKnockoutWinners: Record<string, string> = {};
    for (const [matchId, match] of Object.entries(knockoutMatches)) {
      if (match.winnerId) {
        newKnockoutWinners[matchId] = match.winnerId;
      }
    }

    // Clear advancement flags for any slot whose occupant changed
    const newAdvancement = this.state.advancement.filter((ref) => {
      const oldOccupant = oldOccupants[ref];
      const newOccupant = newOccupants[ref];
      return oldOccupant === newOccupant && oldOccupant !== null;
    });

    return ok(
      new Tournament({
        ...this.state,
        result: {
          groupOrders: currentResult.groupOrders,
          thirdPlaceOrder: orderedIds,
          knockoutWinners: newKnockoutWinners,
        },
        advancement: newAdvancement,
      }),
    );
  }

  setKnockoutWinner(
    matchId: string,
    winnerId: string,
  ): Result<Tournament, DomainError> {
    const currentResult = this.getEffectiveResult();

    // Use prediction-style logic to set knockout winner and cascade
    const r32 = computeR32Matches(
      currentResult.groupOrders,
      currentResult.thirdPlaceOrder,
      combinationsData,
    );
    let knockoutMatches = { ...createEmptyKnockoutMatches(), ...r32 };
    const sorted = Object.entries(currentResult.knockoutWinners).sort(
      ([aId], [bId]) => {
        const aRound = aId.replace(/-\d+$/, "") as KnockoutRound;
        const bRound = bId.replace(/-\d+$/, "") as KnockoutRound;
        return ROUND_ORDER.indexOf(aRound) - ROUND_ORDER.indexOf(bRound);
      },
    );
    for (const [mid, wid] of sorted) {
      const match = knockoutMatches[mid];
      if (match && (match.team1Id === wid || match.team2Id === wid)) {
        knockoutMatches = applyWinnerToMatches(knockoutMatches, mid, wid);
      }
    }

    // Make sure matchId is valid
    if (!knockoutMatches[matchId]) {
      return err(domainError("INVALID_MATCH"));
    }

    // Apply the new winner
    knockoutMatches = applyWinnerToMatches(knockoutMatches, matchId, winnerId);

    const newKnockoutWinners: Record<string, string> = {};
    for (const [mid, match] of Object.entries(knockoutMatches)) {
      if (match.winnerId) {
        newKnockoutWinners[mid] = match.winnerId;
      }
    }

    return ok(
      new Tournament({
        ...this.state,
        result: {
          ...currentResult,
          knockoutWinners: newKnockoutWinners,
        },
      }),
    );
  }

  clearKnockoutWinner(matchId: string): Result<Tournament, DomainError> {
    const currentResult = this.getEffectiveResult();

    // Build the matches
    const r32 = computeR32Matches(
      currentResult.groupOrders,
      currentResult.thirdPlaceOrder,
      combinationsData,
    );
    let knockoutMatches = { ...createEmptyKnockoutMatches(), ...r32 };
    const sorted = Object.entries(currentResult.knockoutWinners).sort(
      ([aId], [bId]) => {
        const aRound = aId.replace(/-\d+$/, "") as KnockoutRound;
        const bRound = bId.replace(/-\d+$/, "") as KnockoutRound;
        return ROUND_ORDER.indexOf(aRound) - ROUND_ORDER.indexOf(bRound);
      },
    );
    for (const [mid, wid] of sorted) {
      const match = knockoutMatches[mid];
      if (match && (match.team1Id === wid || match.team2Id === wid)) {
        // If we are clearing this match, skip applying it here
        if (mid === matchId) continue;
        knockoutMatches = applyWinnerToMatches(knockoutMatches, mid, wid);
      }
    }

    const newKnockoutWinners: Record<string, string> = {};
    for (const [mid, match] of Object.entries(knockoutMatches)) {
      if (match.winnerId) {
        newKnockoutWinners[mid] = match.winnerId;
      }
    }

    return ok(
      new Tournament({
        ...this.state,
        result: {
          ...currentResult,
          knockoutWinners: newKnockoutWinners,
        },
      }),
    );
  }

  markAdvanced(ref: string): Result<Tournament, DomainError> {
    if (!VALID_ADVANCEMENT_REFS.has(ref)) {
      return err(domainError("INVALID_REF"));
    }
    if (this.state.advancement.includes(ref)) {
      return ok(this);
    }
    return ok(
      new Tournament({
        ...this.state,
        advancement: [...this.state.advancement, ref],
      }),
    );
  }

  unmarkAdvanced(ref: string): Result<Tournament, DomainError> {
    if (!VALID_ADVANCEMENT_REFS.has(ref)) {
      return err(domainError("INVALID_REF"));
    }
    if (!this.state.advancement.includes(ref)) {
      return ok(this);
    }
    return ok(
      new Tournament({
        ...this.state,
        advancement: this.state.advancement.filter((r) => r !== ref),
      }),
    );
  }

  bracketView(): Record<string, KnockoutMatch> {
    const currentResult = this.getEffectiveResult();
    return computeTournamentBracket(
      currentResult,
      this.state.advancement,
      combinationsData,
    );
  }
}
