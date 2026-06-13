import { errAsync, okAsync, ResultAsync } from "neverthrow";
import { type DomainError, domainError } from "../domain/errors";
import type { User } from "../domain/user";
import type { UserRepository } from "../domain/user-repository";

export type ChangeRoleCommand = {
  actorId: string;
  targetUserId: string;
  newRole: string;
};

export function changeRole(
  repo: UserRepository,
  command: ChangeRoleCommand,
): ResultAsync<User, DomainError> {
  return ResultAsync.fromSafePromise(repo.findById(command.actorId))
    .andThen((actor) =>
      actor
        ? okAsync(actor)
        : errAsync<User, DomainError>(domainError("FORBIDDEN")),
    )
    .andThen((actor) => {
      return ResultAsync.fromSafePromise(
        repo.findById(command.targetUserId),
      ).andThen((target) =>
        target
          ? okAsync({ actor, target })
          : errAsync<{ actor: User; target: User }, DomainError>(
              domainError("NOT_FOUND"),
            ),
      );
    })
    .andThen(({ actor, target }) => {
      const changeResult = target.changeRole(actor, command.newRole);
      if (changeResult.isErr()) {
        return errAsync<User, DomainError>(changeResult.error);
      }
      const updatedTarget = changeResult.value;
      return repo.save(updatedTarget).map(() => updatedTarget);
    });
}
