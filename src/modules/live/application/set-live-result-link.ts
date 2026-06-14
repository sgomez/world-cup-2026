import { errAsync, ResultAsync } from "neverthrow";
import { type LiveDomainError, liveDomainError } from "../domain/errors";
import type { LiveResultRepository } from "../domain/live-result-repository";
import { isValidNum } from "../domain/match-num";

export type SetLiveResultLinkCommand = {
  num: number;
  link: string;
};

export function setLiveResultLink(
  repo: LiveResultRepository,
  command: SetLiveResultLinkCommand,
): ResultAsync<void, LiveDomainError> {
  if (!isValidNum(command.num)) {
    return errAsync(liveDomainError("INVALID_NUM"));
  }

  return ResultAsync.fromSafePromise(repo.findByNum(command.num)).andThen(
    (existing) => {
      if (existing === null) {
        return errAsync(liveDomainError("NOT_FOUND"));
      }
      return repo.saveLink(command.num, command.link);
    },
  );
}
