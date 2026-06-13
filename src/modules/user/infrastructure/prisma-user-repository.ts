import type { PrismaClient } from "@prisma/client";
import { ResultAsync } from "neverthrow";
import { type DomainError, domainError } from "../domain/errors";
import { User } from "../domain/user";
import type { UserRepository } from "../domain/user-repository";

type UserClient = Pick<PrismaClient, "user">;

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly client: UserClient) {}

  async findById(id: string): Promise<User | null> {
    const row = await this.client.user.findUnique({
      where: { id },
    });
    if (!row) return null;

    return User.fromState({
      id: row.id,
      email: row.email,
      name: row.name,
      emailVerified: row.emailVerified,
      image: row.image,
      role: row.role,
      banned: row.banned,
      banReason: row.banReason,
      banExpires: row.banExpires,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.client.user.findUnique({
      where: { email },
    });
    if (!row) return null;

    return User.fromState({
      id: row.id,
      email: row.email,
      name: row.name,
      emailVerified: row.emailVerified,
      image: row.image,
      role: row.role,
      banned: row.banned,
      banReason: row.banReason,
      banExpires: row.banExpires,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  async count(): Promise<number> {
    return this.client.user.count();
  }

  async countByRole(role: string): Promise<number> {
    return this.client.user.count({
      where: { role },
    });
  }

  save(user: User): ResultAsync<void, DomainError> {
    const state = user.toState();
    return ResultAsync.fromPromise(
      this.client.user
        .upsert({
          where: { id: state.id },
          create: {
            id: state.id,
            email: state.email,
            name: state.name,
            emailVerified: state.emailVerified,
            image: state.image,
            role: state.role,
            banned: state.banned,
            banReason: state.banReason,
            banExpires: state.banExpires,
            createdAt: state.createdAt ?? new Date(),
            updatedAt: state.updatedAt ?? new Date(),
          },
          update: {
            name: state.name,
            image: state.image,
            role: state.role,
            banned: state.banned,
            banReason: state.banReason,
            banExpires: state.banExpires,
            updatedAt: new Date(),
          },
        })
        .then(() => undefined),
      () => domainError("SAVE_FAILED"),
    );
  }

  delete(id: string): ResultAsync<void, DomainError> {
    return ResultAsync.fromPromise(
      this.client.user.delete({ where: { id } }).then(() => undefined),
      () => domainError("SAVE_FAILED"),
    );
  }
}
