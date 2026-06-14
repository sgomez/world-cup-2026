import { slotForNum } from "@/modules/schedule";
import { getTeamById } from "@/modules/teams";
import {
  computeTournamentBracket,
  deriveResult,
} from "@/modules/tournament/domain/derive-result";
import type { LiveResultRepository } from "../domain/live-result-repository";

/**
 * Port: resolves the real home/away team names for a knockout match by num.
 *
 * Group-stage matches (num < 73) always return null — names are in worldcup.json directly.
 * Knockout matches (num >= 73) need bracket derivation from settled LiveResults.
 *
 * Returns null if participants are not yet determinable (groups not all settled,
 * or derivation error). Adapter treats null → Err (skip, no web-guess fallback).
 */
export interface MatchContextResolver {
  /**
   * Returns the resolved { home, away } names for a knockout match.
   * Returns null for group-stage matches or unresolvable knockouts.
   * Synchronous after init(); call init() at the start of each Tick.
   */
  resolveParticipants(num: number): { home: string; away: string } | null;

  /**
   * (Re-)derive the bracket from the current LiveResults.
   * Must be called once at the start of each Tick before resolveParticipants.
   */
  init(): Promise<void>;

  /**
   * Clear the memoized derivation, forcing re-derivation on the next init().
   * Call at the start of each Tick (before init()) to prevent stale cache.
   */
  resetMemo(): void;
}

/**
 * Production implementation.
 * Derives the bracket once per Tick (memoized after init()) and maps
 * match nums to English team names via the teams module.
 */
export class ProductionMatchContextResolver implements MatchContextResolver {
  private cachedBracket: Record<
    string,
    { team1Id: string | null; team2Id: string | null }
  > | null = null;

  constructor(private readonly repo: LiveResultRepository) {}

  resetMemo(): void {
    this.cachedBracket = null;
  }

  async init(): Promise<void> {
    if (this.cachedBracket !== null) {
      // Already memoized for this Tick
      return;
    }

    const liveResults = await this.repo.findAll();
    const finished = liveResults.filter((r) => r.status === "finished");

    // Derive the result model then build the full bracket from it.
    // Using deriveResult + computeTournamentBracket (two-step) so that the
    // deriveResult mock in tests is picked up correctly.
    const derived = deriveResult(finished, {}, null);
    const bracket = computeTournamentBracket(derived);

    // Extract team1Id/team2Id for every match in the bracket
    const simplified: Record<
      string,
      { team1Id: string | null; team2Id: string | null }
    > = {};
    for (const [matchId, km] of Object.entries(bracket)) {
      simplified[matchId] = {
        team1Id: km.team1Id,
        team2Id: km.team2Id,
      };
    }

    this.cachedBracket = simplified;
  }

  resolveParticipants(num: number): { home: string; away: string } | null {
    // Group-stage: not handled by this resolver
    if (num < 73) {
      return null;
    }

    if (this.cachedBracket === null) {
      // init() was not called; return null (safe)
      return null;
    }

    const slotId = slotForNum(num);
    if (!slotId) {
      return null;
    }

    const entry = this.cachedBracket[slotId];
    if (!entry) {
      return null;
    }

    const { team1Id, team2Id } = entry;
    if (!team1Id || !team2Id) {
      return null;
    }

    const team1 = getTeamById(team1Id, "en");
    const team2 = getTeamById(team2Id, "en");

    if (!team1 || !team2) {
      return null;
    }

    return { home: team1.name, away: team2.name };
  }
}
