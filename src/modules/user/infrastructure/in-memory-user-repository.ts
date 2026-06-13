import { okAsync, type ResultAsync } from "neverthrow";
import type { DomainError } from "../domain/errors";
import type { User } from "../domain/user";
import type { UserRepository } from "../domain/user-repository";

export class InMemoryUserRepository implements UserRepository {
  private readonly store = new Map<string, User>();

  constructor(seed: User[] = []) {
    for (const u of seed) {
      this.store.set(u.id, u);
    }
  }

  async findById(id: string): Promise<User | null> {
    return this.store.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    return (
      Array.from(this.store.values()).find((u) => u.email === email) ?? null
    );
  }

  async count(): Promise<number> {
    return this.store.size;
  }

  async countByRole(role: string): Promise<number> {
    return Array.from(this.store.values()).filter((u) => u.role === role)
      .length;
  }

  save(user: User): ResultAsync<void, DomainError> {
    this.store.set(user.id, user);
    return okAsync(undefined);
  }

  delete(id: string): ResultAsync<void, DomainError> {
    this.store.delete(id);
    return okAsync(undefined);
  }

  getData(): Map<string, User> {
    return new Map(this.store);
  }

  setData(data: Map<string, User>) {
    this.store.clear();
    for (const [k, v] of data) {
      this.store.set(k, v);
    }
  }
}
