import type { ResultAsync } from "neverthrow";
import type { Community } from "./community";
import type { DomainError } from "./errors";

export interface CommunityRepository {
  findById(id: string): Promise<Community | null>;
  findBySlug(slug: string): Promise<Community | null>;
  findByInviteToken(token: string): Promise<Community | null>;
  save(community: Community): ResultAsync<void, DomainError>;
  delete(id: string): ResultAsync<void, DomainError>;
}
