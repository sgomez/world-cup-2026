import { err, ok, type Result } from "neverthrow";
import { type LiveDomainError, liveDomainError } from "./errors";
import type { LiveDomainEvent } from "./events";

export type LiveStatus = "upcoming" | "live" | "finished";

export type LiveResultState = {
  num: number;
  status: LiveStatus;
  goals1: number;
  goals2: number;
  penalties1?: number;
  penalties2?: number;
  createdAt?: Date;
  updatedAt?: Date;
};

export type ReconcileTarget = {
  num: number;
  status: LiveStatus;
  goals1: number;
  goals2: number;
  penalties1?: number;
  penalties2?: number;
};

/** Match numbers >= 73 are knockout matches; penalties are only valid for those. */
function isKnockout(num: number): boolean {
  return num >= 73;
}

function validateTarget(
  target: ReconcileTarget,
): Result<void, LiveDomainError> {
  if (target.status === "upcoming") {
    if (target.goals1 !== 0 || target.goals2 !== 0) {
      return err(liveDomainError("INVALID_GOALS"));
    }
    if (target.penalties1 !== undefined || target.penalties2 !== undefined) {
      return err(liveDomainError("PENALTIES_NOT_ALLOWED"));
    }
  }

  if (target.goals1 < 0 || target.goals2 < 0) {
    return err(liveDomainError("INVALID_GOALS"));
  }
  // Asymmetric penalty state: both or neither must be provided
  if (
    (target.penalties1 !== undefined && target.penalties2 === undefined) ||
    (target.penalties1 === undefined && target.penalties2 !== undefined)
  ) {
    return err(liveDomainError("PENALTIES_NOT_ALLOWED"));
  }
  // Penalties only allowed on knockout matches (num >= 73)
  if (
    (target.penalties1 !== undefined || target.penalties2 !== undefined) &&
    !isKnockout(target.num)
  ) {
    return err(liveDomainError("PENALTIES_NOT_ALLOWED"));
  }
  return ok(undefined);
}

export class LiveResult {
  private constructor(private readonly state: LiveResultState) {}

  static fromState(state: LiveResultState): LiveResult {
    return new LiveResult({ ...state });
  }

  get num(): number {
    return this.state.num;
  }

  get status(): LiveStatus {
    return this.state.status;
  }

  get goals1(): number {
    return this.state.goals1;
  }

  get goals2(): number {
    return this.state.goals2;
  }

  get penalties1(): number | undefined {
    return this.state.penalties1;
  }

  get penalties2(): number | undefined {
    return this.state.penalties2;
  }

  get createdAt(): Date | undefined {
    return this.state.createdAt;
  }

  get updatedAt(): Date | undefined {
    return this.state.updatedAt;
  }

  toState(): LiveResultState {
    return { ...this.state };
  }

  /**
   * Reconcile current state (or null for a new match) to the provided target.
   *
   * Returns a tuple of:
   * - Result<LiveResult, LiveDomainError> — the new aggregate or an error
   * - LiveDomainEvent[] — the events produced by the transition
   *
   * Events are produced even on error (empty array), so the tuple is always valid.
   */
  static reconcile(
    current: LiveResult | null,
    target: ReconcileTarget,
    adminOverride?: boolean,
  ): [Result<LiveResult, LiveDomainError>, LiveDomainEvent[]] {
    const validation = validateTarget(target);
    if (validation.isErr()) {
      return [err(validation.error), []];
    }

    const events: LiveDomainEvent[] = [];

    // Finished latch: once finished, a later 'live' or 'upcoming' snapshot is ignored unless adminOverride is true
    if (
      !adminOverride &&
      current !== null &&
      current.status === "finished" &&
      (target.status === "live" || target.status === "upcoming")
    ) {
      return [ok(current), []];
    }

    const isNew = current === null;

    const wasStarted = current !== null && current.status !== "upcoming";
    const isStarting = target.status === "live" || target.status === "finished";
    if (!wasStarted && isStarting) {
      events.push({ type: "MatchStarted", num: target.num });
    }

    // Penalties change detection (for knockout matches)
    const currentPen1 = current?.penalties1;
    const currentPen2 = current?.penalties2;
    const hasPenaltiesNow =
      target.penalties1 !== undefined && target.penalties2 !== undefined;
    const penaltiesChanged =
      hasPenaltiesNow &&
      (currentPen1 !== target.penalties1 || currentPen2 !== target.penalties2);

    // Score change detection (only emit while live; finished will emit MatchFinished instead)
    const currentGoals1 = current?.goals1 ?? 0;
    const currentGoals2 = current?.goals2 ?? 0;
    const goalsChanged =
      currentGoals1 !== target.goals1 || currentGoals2 !== target.goals2;

    const wasLive = current === null || current.status === "live";
    const becomesFinished = target.status === "finished";
    const becomesLive = target.status === "live";

    if (!isNew && wasLive && becomesLive && goalsChanged) {
      events.push({
        type: "MatchScoreChanged",
        num: target.num,
        goals1: target.goals1,
        goals2: target.goals2,
      });
    }

    if (
      penaltiesChanged &&
      target.penalties1 !== undefined &&
      target.penalties2 !== undefined
    ) {
      events.push({
        type: "MatchPenaltiesChanged",
        num: target.num,
        pen1: target.penalties1,
        pen2: target.penalties2,
      });
    }

    const wasFinished = current?.status === "finished";

    if (becomesFinished) {
      // Emit MatchFinished if:
      // - transitioning live→finished, OR
      // - was already finished but score/penalties changed (correction)
      const scoreOrPenChange =
        goalsChanged ||
        (wasFinished &&
          hasPenaltiesNow &&
          (currentPen1 !== target.penalties1 ||
            currentPen2 !== target.penalties2));

      if (!wasFinished || scoreOrPenChange) {
        events.push({
          type: "MatchFinished",
          num: target.num,
          goals1: target.goals1,
          goals2: target.goals2,
          ...(target.penalties1 !== undefined && target.penalties2 !== undefined
            ? { penalties1: target.penalties1, penalties2: target.penalties2 }
            : {}),
        });
      }
    }

    // No-op check — if nothing changed and we produced no events
    // (excluding MatchStarted/status change case), return current unchanged
    const statusChanged = current !== null && current.status !== target.status;
    if (events.length === 0 && current !== null && !statusChanged) {
      return [ok(current), []];
    }

    const newState: LiveResultState = {
      num: target.num,
      status: target.status,
      goals1: target.status === "upcoming" ? 0 : target.goals1,
      goals2: target.status === "upcoming" ? 0 : target.goals2,
      ...(target.status !== "upcoming" && target.penalties1 !== undefined
        ? { penalties1: target.penalties1 }
        : {}),
      ...(target.status !== "upcoming" && target.penalties2 !== undefined
        ? { penalties2: target.penalties2 }
        : {}),
      createdAt: current?.createdAt,
      updatedAt: current?.updatedAt,
    };

    return [ok(new LiveResult(newState)), events];
  }
}
