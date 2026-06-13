import { errAsync, okAsync, ResultAsync } from "neverthrow";
import { type DomainError, domainError } from "../domain/errors";
import type { User } from "../domain/user";
import type { UserRepository } from "../domain/user-repository";

export type PromoteFirstRegistrantCommand = {
  userId: string;
};

export function promoteFirstRegistrant(
  repo: UserRepository,
  command: PromoteFirstRegistrantCommand,
): ResultAsync<User, DomainError> {
  return ResultAsync.fromSafePromise(repo.findById(command.userId))
    .andThen((user) =>
      user
        ? okAsync(user)
        : errAsync<User, DomainError>(domainError("NOT_FOUND")),
    )
    .andThen((user) => {
      return ResultAsync.fromSafePromise(
        repo.countByRole("super_admin"),
      ).andThen((count) => {
        if (count === 0) {
          const promoted = user.promoteToSuperAdmin();
          return repo.save(promoted).map(() => promoted);
        }
        return okAsync(user);
      });
    });
}
