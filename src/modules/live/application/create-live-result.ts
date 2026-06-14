import { errAsync, ResultAsync } from "neverthrow";
import { type LiveDomainError, liveDomainError } from "../domain/errors";
import { LiveResult } from "../domain/live-result";
import type { LiveResultRepository } from "../domain/live-result-repository";

const MIN_MATCH_NUM = 1;
const MAX_MATCH_NUM = 104;

function isValidNum(num: number): boolean {
  return Number.isInteger(num) && num >= MIN_MATCH_NUM && num <= MAX_MATCH_NUM;
}

export type CreateLiveResultCommand = {
  num: number;
  link?: string;
};

export type CreateLiveResultOutput = {
  liveResult: LiveResult;
};

export function createLiveResult(
  repo: LiveResultRepository,
  command: CreateLiveResultCommand,
): ResultAsync<CreateLiveResultOutput, LiveDomainError> {
  if (!isValidNum(command.num)) {
    return errAsync(liveDomainError("INVALID_NUM"));
  }

  return ResultAsync.fromSafePromise(repo.findByNum(command.num)).andThen(
    (existing) => {
      if (existing !== null) {
        return errAsync(liveDomainError("ALREADY_EXISTS"));
      }

      const liveResult = LiveResult.fromState({
        num: command.num,
        status: "upcoming",
        goals1: 0,
        goals2: 0,
        link: command.link,
      });

      return repo.save(liveResult).map(() => ({ liveResult }));
    },
  );
}
