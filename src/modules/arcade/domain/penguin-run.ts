import { randomUUID } from "node:crypto";
import type { DomainError } from "./errors";
import { domainError } from "./errors";

/**
 * The status of a PenguinRun lifecycle.
 *
 * - `in_progress`: the run has started, some Rounds may still be played.
 * - `finished`: all three Rounds have been completed by the player.
 * - `finalised`: the run was closed by the server (disconnect / stale heartbeat).
 */
export type PenguinRunStatus = "in_progress" | "finished" | "finalised";

/**
 * A Play Day is the UTC calendar date string (YYYY-MM-DD) that identifies
 * which UTC day a run belongs to. Resets at 00:00 UTC.
 */
export type PlayDay = string;

/**
 * A recorded Round within a PenguinRun.
 */
export type RoundRecord = {
  roundNumber: number;
  startedAt: Date;
  endedAt: Date;
  score: number;
};

/**
 * Converts a timestamp to a Play Day string (UTC calendar date).
 *
 * This is the canonical function for deriving Play Day from a Date — always
 * use the server clock, never the client's local time.
 */
export function toPlayDay(date: Date): PlayDay {
  return date.toISOString().slice(0, 10);
}

/**
 * Computes the UTC calendar week range (Monday to Sunday) containing `date`.
 *
 * Returns `start` as Monday 00:00:00.000 UTC and `end` as Sunday
 * 23:59:59.999 UTC of the same week. ISO week convention: week starts on
 * Monday (day 1), Sunday is day 0 (treated as day 7 for offset arithmetic).
 */
export function getWeekRange(date: Date): { start: Date; end: Date } {
  // getUTCDay() returns 0=Sun, 1=Mon, ... 6=Sat.
  // We treat Sunday (0) as 7 so Monday is offset 0.
  const dayOfWeek = date.getUTCDay(); // 0=Sun, 1=Mon, …, 6=Sat
  const offsetToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const startMs =
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      0,
      0,
      0,
      0,
    ) -
    offsetToMonday * 24 * 60 * 60 * 1000;

  const endMs = startMs + 7 * 24 * 60 * 60 * 1000 - 1;

  return { start: new Date(startMs), end: new Date(endMs) };
}

/**
 * Points awarded per second of survival time.
 * This is the single monotonic function that maps elapsed time → score ceiling.
 * A client-reported score cannot exceed elapsedSeconds * POINTS_PER_SECOND.
 */
export const POINTS_PER_SECOND = 1;

/**
 * Maximum number of Rounds (Lives) in a single PenguinRun.
 */
export const MAX_ROUNDS = 3;

/**
 * Derives the score ceiling for a Round given its server-stamped start and end times.
 * A reported score above this is capped. ADR 0034.
 */
export function computeScoreCeiling(startedAt: Date, endedAt: Date): number {
  const elapsedMs = endedAt.getTime() - startedAt.getTime();
  const elapsedSeconds = Math.max(0, elapsedMs / 1000);
  return Math.floor(elapsedSeconds * POINTS_PER_SECOND);
}

export type PenguinRunState = {
  id: string;
  userId: string;
  playDay: PlayDay;
  startedAt: Date;
  lastSeenAt: Date;
  status: PenguinRunStatus;
  bestScore: number;
  rounds: RoundRecord[];
};

/**
 * The PenguinRun aggregate. Represents a single User's daily arcade attempt.
 *
 * Business rules:
 * - One run per User per Play Day (UTC calendar day).
 * - Starting a run immediately consumes that User's daily play.
 * - A run holds up to three Rounds (Lives); the best Round score is kept.
 * - The server clock is authoritative; client timestamps are never trusted.
 * - A reported score above the time-derived ceiling is capped (ADR 0034).
 * - A periodic Heartbeat proves the run is live; if it lapses beyond tolerance,
 *   the run is finalised server-side with the best Round score so far.
 */
export class PenguinRun {
  private constructor(private readonly state: PenguinRunState) {}

  /**
   * Factory: creates a brand-new PenguinRun for a User on the Play Day
   * derived from `startedAt`. Consumes the User's daily play immediately.
   */
  static create(args: { userId: string; startedAt: Date }): PenguinRun {
    const playDay = toPlayDay(args.startedAt);
    return new PenguinRun({
      id: randomUUID(),
      userId: args.userId,
      playDay,
      startedAt: args.startedAt,
      lastSeenAt: args.startedAt,
      status: "in_progress",
      bestScore: 0,
      rounds: [],
    });
  }

  /**
   * Factory: reconstructs a PenguinRun from persisted state (repository use).
   */
  static fromState(state: PenguinRunState): PenguinRun {
    return new PenguinRun(state);
  }

  get id(): string {
    return this.state.id;
  }

  get userId(): string {
    return this.state.userId;
  }

  get playDay(): PlayDay {
    return this.state.playDay;
  }

  get startedAt(): Date {
    return this.state.startedAt;
  }

  get lastSeenAt(): Date {
    return this.state.lastSeenAt;
  }

  get status(): PenguinRunStatus {
    return this.state.status;
  }

  get bestScore(): number {
    return this.state.bestScore;
  }

  get rounds(): ReadonlyArray<RoundRecord> {
    return this.state.rounds;
  }

  isOwnedBy(userId: string): boolean {
    return this.state.userId === userId;
  }

  /**
   * Returns whether this run's heartbeat has lapsed beyond `toleranceMs`.
   * Used by `getArcadeRanking` to lazily finalise stale runs on read.
   */
  isStale(now: Date, toleranceMs: number): boolean {
    return now.getTime() - this.state.lastSeenAt.getTime() > toleranceMs;
  }

  /**
   * Records a Heartbeat for this run, updating `lastSeenAt` to `now`.
   * Returns the updated run, or a DomainError if the run is not in_progress.
   */
  recordHeartbeat(now: Date): PenguinRun | DomainError {
    if (this.state.status !== "in_progress") {
      return domainError("RUN_NOT_IN_PROGRESS");
    }
    return new PenguinRun({ ...this.state, lastSeenAt: now });
  }

  /**
   * Records the end of a Round (Life).
   *
   * - The Round's score is capped by the time-derived ceiling (ADR 0034).
   * - Round scores are independent; each Round resets to zero.
   * - `bestScore` is the highest of all Rounds recorded so far.
   * - After three Rounds the run transitions to `finished`.
   *
   * Returns the updated run, or a DomainError if the run is not in_progress.
   */
  recordRound(args: {
    roundStartedAt: Date;
    roundEndedAt: Date;
    reportedScore: number;
  }): PenguinRun | DomainError {
    if (this.state.status !== "in_progress") {
      return domainError("RUN_NOT_IN_PROGRESS");
    }

    const ceiling = computeScoreCeiling(args.roundStartedAt, args.roundEndedAt);
    const score = Math.min(args.reportedScore, ceiling);

    const roundNumber = this.state.rounds.length + 1;
    const newRound: RoundRecord = {
      roundNumber,
      startedAt: args.roundStartedAt,
      endedAt: args.roundEndedAt,
      score,
    };

    const updatedRounds = [...this.state.rounds, newRound];
    const updatedBestScore = Math.max(this.state.bestScore, score);
    const updatedStatus: PenguinRunStatus =
      updatedRounds.length >= MAX_ROUNDS ? "finished" : "in_progress";

    return new PenguinRun({
      ...this.state,
      rounds: updatedRounds,
      bestScore: updatedBestScore,
      status: updatedStatus,
    });
  }

  /**
   * Manually transitions an in_progress run to `finished`.
   * Called when the player explicitly finishes before all 3 rounds,
   * or by the `finishPenguinRun` use case after all rounds are played.
   */
  finish(): PenguinRun {
    return new PenguinRun({ ...this.state, status: "finished" });
  }

  /**
   * Finalises this run server-side (stale heartbeat / disconnect).
   * Preserves the best Round score reached so far; Play Day stays consumed.
   */
  finalise(now: Date): PenguinRun {
    return new PenguinRun({
      ...this.state,
      status: "finalised",
      lastSeenAt: now,
    });
  }

  toState(): PenguinRunState {
    return { ...this.state, rounds: [...this.state.rounds] };
  }
}
