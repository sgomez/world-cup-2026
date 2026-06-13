import { err, ok, type Result } from "neverthrow";
import { type DomainError, domainError } from "./errors";

export type UserState = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  image: string | null;
  role: string;
  banned: boolean;
  banReason: string | null;
  banExpires: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export class User {
  private constructor(private readonly state: UserState) {}

  static fromState(state: UserState): User {
    return new User({
      ...state,
    });
  }

  static create(params: {
    id: string;
    email: string;
    name: string;
    emailVerified: boolean;
    image: string | null;
    role?: string;
  }): Result<User, DomainError> {
    const trimmedName = params.name.trim();
    if (trimmedName === "") {
      return err(domainError("NAME_REQUIRED"));
    }

    return ok(
      new User({
        id: params.id,
        email: params.email,
        name: trimmedName,
        emailVerified: params.emailVerified,
        image: params.image?.trim() || null,
        role: params.role || "user",
        banned: false,
        banReason: null,
        banExpires: null,
      }),
    );
  }

  get id(): string {
    return this.state.id;
  }

  get name(): string {
    return this.state.name;
  }

  get email(): string {
    return this.state.email;
  }

  get emailVerified(): boolean {
    return this.state.emailVerified;
  }

  get image(): string | null {
    return this.state.image;
  }

  get role(): string {
    return this.state.role;
  }

  get banned(): boolean {
    return this.state.banned;
  }

  get banReason(): string | null {
    return this.state.banReason;
  }

  get banExpires(): Date | null {
    return this.state.banExpires;
  }

  get createdAt(): Date | undefined {
    return this.state.createdAt;
  }

  get updatedAt(): Date | undefined {
    return this.state.updatedAt;
  }

  toState(): UserState {
    return {
      ...this.state,
    };
  }

  updateProfile(name: string, image: string | null): Result<User, DomainError> {
    const trimmedName = name.trim();
    if (trimmedName === "") {
      return err(domainError("NAME_REQUIRED"));
    }

    return ok(
      new User({
        ...this.state,
        name: trimmedName,
        image: image?.trim() || null,
      }),
    );
  }

  changeRole(actor: User, newRole: string): Result<User, DomainError> {
    if (this.role === "super_admin") {
      return err(domainError("SUPER_ADMIN_IMMUTABLE"));
    }

    if (actor.id === this.id) {
      return err(domainError("SELF_DEMOTION_NOT_ALLOWED"));
    }

    if (actor.role !== "admin" && actor.role !== "super_admin") {
      return err(domainError("FORBIDDEN"));
    }

    return ok(
      new User({
        ...this.state,
        role: newRole,
      }),
    );
  }
}
