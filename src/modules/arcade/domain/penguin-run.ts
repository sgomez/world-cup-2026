import { randomUUID } from "node:crypto";

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
 * Converts a timestamp to a Play Day string (UTC calendar date).
 *
 * This is the canonical function for deriving Play Day from a Date — always
 * use the server clock, never the client's local time.
 */
export function toPlayDay(date: Date): PlayDay {
  return date.toISOString().slice(0, 10);
}

export type PenguinRunState = {
  id: string;
  userId: string;
  playDay: PlayDay;
  startedAt: Date;
  lastSeenAt: Date;
  status: PenguinRunStatus;
  bestScore: number;
};

/**
 * The PenguinRun aggregate. Represents a single User's daily arcade attempt.
 *
 * Business rules:
 * - One run per User per Play Day (UTC calendar day).
 * - Starting a run immediately consumes that User's daily play.
 * - A run holds up to three Rounds (Lives); the best Round score is kept.
 * - The server clock is authoritative; client timestamps are never trusted.
 *
 * This slice covers only the lifecycle start; round recording and score
 * ceiling enforcement are added in later slices.
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

  isOwnedBy(userId: string): boolean {
    return this.state.userId === userId;
  }

  toState(): PenguinRunState {
    return { ...this.state };
  }
}
