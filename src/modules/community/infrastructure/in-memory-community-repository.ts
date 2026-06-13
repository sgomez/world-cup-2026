import { okAsync, type ResultAsync } from "neverthrow";
import type { Community } from "../domain/community";
import type { CommunityRepository } from "../domain/community-repository";
import type { DomainError } from "../domain/errors";

export class InMemoryCommunityRepository implements CommunityRepository {
  private readonly store = new Map<string, Community>();

  constructor(seed: Community[] = []) {
    for (const comm of seed) {
      this.store.set(comm.id, comm);
    }
  }

  async findById(id: string): Promise<Community | null> {
    return this.store.get(id) ?? null;
  }

  async findBySlug(slug: string): Promise<Community | null> {
    return (
      Array.from(this.store.values()).find((comm) => comm.slug === slug) ?? null
    );
  }

  async findByInviteToken(token: string): Promise<Community | null> {
    return (
      Array.from(this.store.values()).find(
        (comm) => comm.inviteToken === token,
      ) ?? null
    );
  }

  save(community: Community): ResultAsync<void, DomainError> {
    this.store.set(community.id, community);
    return okAsync(undefined);
  }

  delete(id: string): ResultAsync<void, DomainError> {
    this.store.delete(id);
    return okAsync(undefined);
  }

  getData(): Map<string, Community> {
    return new Map(this.store);
  }

  setData(data: Map<string, Community>) {
    this.store.clear();
    for (const [k, v] of data) {
      this.store.set(k, v);
    }
  }
}
