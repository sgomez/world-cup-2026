import { ok, type Result } from "neverthrow";
import type { KnockoutMatch } from "@/modules/bracket";
import type { LiveResult } from "@/modules/live/domain/live-result";
import {
  buildBracketView,
  type DeriveOptions,
  isCompetitionEndedFromLiveResults,
} from "./derive-result";
import type { DomainError } from "./errors";

/**
 * The only persistent state for the tournament singleton.
 *
 * ADR 0015: `result` (groupOrders / thirdPlaceOrder / knockoutWinners) and
 * `advancement` are dropped — everything is derived on read from LiveResults.
 * Only the sparse Manual Tie-Break exception map is stored.
 */
export type TournamentState = {
  id: string;
  /** Per-group Admin-supplied tie-break factors. Key = uppercase group letter (e.g. "A"). */
  manualTieBreaks: Record<string, Record<string, number>>;
  /** Admin-supplied thirds ranking override. Null if no manual override. */
  thirdPlaceManualOrder: Record<string, number> | null;
  createdAt?: Date;
  updatedAt?: Date;
};

function normalizeManualTieBreaks(
  input: unknown,
): Record<string, Record<string, number>> {
  if (!input || typeof input !== "object") return {};

  const result: Record<string, Record<string, number>> = {};
  for (const [group, value] of Object.entries(
    input as Record<string, unknown>,
  )) {
    if (!value) continue;
    if (Array.isArray(value)) {
      const len = value.length;
      const factors: Record<string, number> = {};
      value.forEach((teamId, index) => {
        if (typeof teamId === "string") {
          factors[teamId] = len - index;
        }
      });
      result[group] = factors;
    } else if (typeof value === "object") {
      result[group] = value as Record<string, number>;
    }
  }
  return result;
}

function normalizeThirdPlaceManualOrder(
  input: unknown,
): Record<string, number> | null {
  if (!input) return null;
  if (Array.isArray(input)) {
    const len = input.length;
    const factors: Record<string, number> = {};
    input.forEach((teamId, index) => {
      if (typeof teamId === "string") {
        factors[teamId] = len - index;
      }
    });
    return factors;
  }
  if (typeof input === "object") {
    return input as Record<string, number>;
  }
  return null;
}

export class Tournament {
  private constructor(private readonly state: TournamentState) {}

  static fromState(state: {
    id: string;
    manualTieBreaks?: unknown;
    thirdPlaceManualOrder?: unknown;
    createdAt?: Date;
    updatedAt?: Date;
  }): Tournament {
    return new Tournament({
      id: state.id,
      manualTieBreaks: normalizeManualTieBreaks(state.manualTieBreaks),
      thirdPlaceManualOrder: normalizeThirdPlaceManualOrder(
        state.thirdPlaceManualOrder,
      ),
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
    });
  }

  static createDefault(id = "singleton"): Tournament {
    return new Tournament({
      id,
      manualTieBreaks: {},
      thirdPlaceManualOrder: null,
    });
  }

  get id(): string {
    return this.state.id;
  }

  get manualTieBreaks(): Record<string, Record<string, number>> {
    return this.state.manualTieBreaks;
  }

  get thirdPlaceManualOrder(): Record<string, number> | null {
    return this.state.thirdPlaceManualOrder;
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

  /**
   * Sets the manual tie-break factors for a group.
   * Groups outside A–L are silently ignored.
   */
  setManualTieBreak(
    group: string,
    factors: Record<string, number>,
  ): Result<Tournament, DomainError> {
    return ok(
      new Tournament({
        ...this.state,
        manualTieBreaks: {
          ...this.state.manualTieBreaks,
          [group]: factors,
        },
      }),
    );
  }

  /**
   * Clears the manual tie-break for a group.
   */
  clearManualTieBreak(group: string): Result<Tournament, DomainError> {
    const updated = { ...this.state.manualTieBreaks };
    delete updated[group];
    return ok(
      new Tournament({
        ...this.state,
        manualTieBreaks: updated,
      }),
    );
  }

  /**
   * Sets the manual factors for the cross-group thirds cluster.
   */
  setThirdPlaceManualOrder(
    factors: Record<string, number> | null,
  ): Result<Tournament, DomainError> {
    return ok(
      new Tournament({
        ...this.state,
        thirdPlaceManualOrder: factors,
      }),
    );
  }

  /**
   * Returns the full knockout bracket derived on-read from LiveResults.
   *
   * Pass `options.finishedOnly = false` to include provisional standings
   * from live (in-progress) matches in the bracket occupants.
   */
  bracketView(
    liveResults: LiveResult[],
    options?: DeriveOptions,
  ): Record<string, KnockoutMatch> {
    return buildBracketView(
      liveResults,
      this.state.manualTieBreaks,
      this.state.thirdPlaceManualOrder,
      options,
    );
  }

  /**
   * Returns true when Competition End is reached — both the third-place match
   * (num=103) and the Final (num=104) are finished.
   *
   * ADR 0015: derived from LiveResults, never a stored flag.
   */
  isCompetitionEnded(liveResults: LiveResult[]): boolean {
    return isCompetitionEndedFromLiveResults(liveResults);
  }
}
