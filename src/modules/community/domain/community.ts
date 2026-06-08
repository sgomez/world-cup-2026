import { randomUUID } from "node:crypto";
import { err, ok, type Result } from "neverthrow";
import type { CommunityName } from "./community-name";
import type { CommunitySlug } from "./community-slug";
import { type DomainError, domainError } from "./errors";

export type CommunityState = {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  inviteToken: string;
  memberIds: string[];
  createdAt?: Date;
  updatedAt?: Date;
};

export class Community {
  private constructor(private readonly state: CommunityState) {}

  static fromState(state: CommunityState): Community {
    return new Community({
      ...state,
      memberIds: [...state.memberIds],
    });
  }

  static create(
    name: CommunityName,
    slug: CommunitySlug,
    ownerId: string,
    inviteToken: string,
  ): Community {
    return new Community({
      id: randomUUID(),
      name: name.value,
      slug: slug.value,
      ownerId,
      inviteToken,
      memberIds: [ownerId],
    });
  }

  get id(): string {
    return this.state.id;
  }

  get name(): string {
    return this.state.name;
  }

  get slug(): string {
    return this.state.slug;
  }

  get ownerId(): string {
    return this.state.ownerId;
  }

  get inviteToken(): string {
    return this.state.inviteToken;
  }

  get memberIds(): string[] {
    return this.state.memberIds;
  }

  get createdAt(): Date | undefined {
    return this.state.createdAt;
  }

  get updatedAt(): Date | undefined {
    return this.state.updatedAt;
  }

  toState(): CommunityState {
    return {
      ...this.state,
      memberIds: [...this.state.memberIds],
    };
  }

  join(userId: string): Result<Community, DomainError> {
    if (this.state.memberIds.includes(userId)) {
      return ok(this);
    }
    return ok(
      new Community({
        ...this.state,
        memberIds: [...this.state.memberIds, userId],
      }),
    );
  }

  leave(userId: string): Result<Community, DomainError> {
    if (userId === this.state.ownerId) {
      return err(domainError("OWNER_CANNOT_LEAVE"));
    }
    if (!this.state.memberIds.includes(userId)) {
      return err(domainError("NOT_A_MEMBER"));
    }
    return ok(
      new Community({
        ...this.state,
        memberIds: this.state.memberIds.filter((id) => id !== userId),
      }),
    );
  }

  removeMember(
    targetUserId: string,
    actorId: string,
  ): Result<Community, DomainError> {
    if (actorId !== this.state.ownerId) {
      return err(domainError("FORBIDDEN"));
    }
    if (targetUserId === this.state.ownerId) {
      return err(domainError("FORBIDDEN"));
    }
    if (!this.state.memberIds.includes(targetUserId)) {
      return err(domainError("NOT_A_MEMBER"));
    }
    return ok(
      new Community({
        ...this.state,
        memberIds: this.state.memberIds.filter((id) => id !== targetUserId),
      }),
    );
  }

  regenerateInviteToken(
    ownerId: string,
    newToken: string,
  ): Result<Community, DomainError> {
    if (ownerId !== this.state.ownerId) {
      return err(domainError("FORBIDDEN"));
    }
    return ok(
      new Community({
        ...this.state,
        inviteToken: newToken,
      }),
    );
  }
}
