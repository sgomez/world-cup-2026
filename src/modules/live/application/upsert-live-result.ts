import { errAsync, ResultAsync } from "neverthrow";
import { type LiveDomainError, liveDomainError } from "../domain/errors";
import type { LiveDomainEvent } from "../domain/events";
import type { MatchPhase } from "../domain/live-feed";
import { LiveResult, type LiveStatus } from "../domain/live-result";
import type { LiveResultRepository } from "../domain/live-result-repository";

/** Valid match numbers: 1–104 */
const MIN_MATCH_NUM = 1;
const MAX_MATCH_NUM = 104;

function isValidNum(num: number): boolean {
  return Number.isInteger(num) && num >= MIN_MATCH_NUM && num <= MAX_MATCH_NUM;
}

export type UpsertLiveResultCommand = {
  num: number;
  status: LiveStatus;
  goals1: number;
  goals2: number;
  penalties1?: number;
  penalties2?: number;
  phase?: MatchPhase | null;
  minute?: number | null;
  inStoppage?: boolean | null;
  /**
   * true  → PUT semantics: create or replace
   * false → PATCH semantics: merge onto existing row; 404 if none
   */
  allowCreate: boolean;
  adminOverride?: boolean;
};

export type UpsertLiveResultOutput = {
  liveResult: LiveResult;
  events: LiveDomainEvent[];
};

export function upsertLiveResult(
  repo: LiveResultRepository,
  command: UpsertLiveResultCommand,
): ResultAsync<UpsertLiveResultOutput, LiveDomainError> {
  if (!isValidNum(command.num)) {
    return errAsync(liveDomainError("INVALID_NUM"));
  }

  return ResultAsync.fromSafePromise(repo.findByNum(command.num)).andThen(
    (existing) => {
      // PATCH requires an existing row
      if (!command.allowCreate && existing === null) {
        return errAsync(liveDomainError("NOT_FOUND"));
      }

      const target = {
        num: command.num,
        status: command.status,
        goals1: command.goals1,
        goals2: command.goals2,
        ...(command.penalties1 !== undefined
          ? { penalties1: command.penalties1 }
          : {}),
        ...(command.penalties2 !== undefined
          ? { penalties2: command.penalties2 }
          : {}),
        phase: command.phase ?? null,
        minute: command.minute ?? null,
        inStoppage: command.inStoppage ?? null,
      };

      const [reconcileResult, events] = LiveResult.reconcile(
        existing,
        target,
        command.adminOverride,
      );

      if (reconcileResult.isErr()) {
        return errAsync(reconcileResult.error);
      }

      const newLiveResult = reconcileResult._unsafeUnwrap();

      // No-op: nothing changed, skip persistence
      const statusChanged =
        existing !== null && existing.status !== newLiveResult.status;
      const phaseChanged =
        existing !== null &&
        (existing.phase !== newLiveResult.phase ||
          existing.minute !== newLiveResult.minute ||
          existing.inStoppage !== newLiveResult.inStoppage);
      if (
        events.length === 0 &&
        existing !== null &&
        !statusChanged &&
        !phaseChanged
      ) {
        return ResultAsync.fromSafePromise(
          Promise.resolve({ liveResult: newLiveResult, events }),
        );
      }

      return repo
        .save(newLiveResult)
        .map(() => ({ liveResult: newLiveResult, events }));
    },
  );
}
