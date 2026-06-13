import { errAsync, okAsync, ResultAsync } from "neverthrow";
import { type DomainError, domainError } from "../domain/errors";
import type { User } from "../domain/user";
import type { UserRepository } from "../domain/user-repository";

export type UpdateProfileCommand = {
  userId: string;
  name: string;
  image: string | null;
};

export function updateProfile(
  repo: UserRepository,
  command: UpdateProfileCommand,
): ResultAsync<User, DomainError> {
  return ResultAsync.fromSafePromise(repo.findById(command.userId))
    .andThen((user) =>
      user
        ? okAsync(user)
        : errAsync<User, DomainError>(domainError("NOT_FOUND")),
    )
    .andThen((user) => {
      const updateResult = user.updateProfile(command.name, command.image);
      if (updateResult.isErr()) {
        return errAsync<User, DomainError>(updateResult.error);
      }
      const updatedUser = updateResult.value;
      return repo.save(updatedUser).map(() => updatedUser);
    });
}
