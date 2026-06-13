import type { ResultAsync } from "neverthrow";
import type { DomainError } from "./errors";
import type { User } from "./user";

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  count(): Promise<number>;
  save(user: User): ResultAsync<void, DomainError>;
  delete(id: string): ResultAsync<void, DomainError>;
}
