import type { PrismaClient } from "@prisma/client";
import { ResultAsync } from "neverthrow";
import { Community } from "../domain/community";
import type { CommunityRepository } from "../domain/community-repository";
import { type DomainError, domainError } from "../domain/errors";

type CommunityClient = Pick<
  PrismaClient,
  "community" | "communityMember" | "$transaction"
>;

export class PrismaCommunityRepository implements CommunityRepository {
  constructor(private readonly client: CommunityClient) {}

  async findById(id: string): Promise<Community | null> {
    const row = await this.client.community.findUnique({
      where: { id },
      include: {
        members: {
          select: { userId: true },
        },
      },
    });
    if (!row) return null;

    return Community.fromState({
      id: row.id,
      name: row.name,
      slug: row.slug,
      ownerId: row.ownerId,
      inviteToken: row.inviteToken,
      memberIds: row.members.map((m) => m.userId),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  async findBySlug(slug: string): Promise<Community | null> {
    const row = await this.client.community.findUnique({
      where: { slug },
      include: {
        members: {
          select: { userId: true },
        },
      },
    });
    if (!row) return null;

    return Community.fromState({
      id: row.id,
      name: row.name,
      slug: row.slug,
      ownerId: row.ownerId,
      inviteToken: row.inviteToken,
      memberIds: row.members.map((m) => m.userId),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  async findByInviteToken(token: string): Promise<Community | null> {
    const row = await this.client.community.findUnique({
      where: { inviteToken: token },
      include: {
        members: {
          select: { userId: true },
        },
      },
    });
    if (!row) return null;

    return Community.fromState({
      id: row.id,
      name: row.name,
      slug: row.slug,
      ownerId: row.ownerId,
      inviteToken: row.inviteToken,
      memberIds: row.members.map((m) => m.userId),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  save(community: Community): ResultAsync<void, DomainError> {
    const state = community.toState();
    return ResultAsync.fromPromise(
      this.client
        .$transaction(async (tx) => {
          await tx.community.upsert({
            where: { id: state.id },
            create: {
              id: state.id,
              name: state.name,
              slug: state.slug,
              ownerId: state.ownerId,
              inviteToken: state.inviteToken,
            },
            update: {
              name: state.name,
              slug: state.slug,
              ownerId: state.ownerId,
              inviteToken: state.inviteToken,
            },
          });

          const existingMembers = await tx.communityMember.findMany({
            where: { communityId: state.id },
            select: { userId: true },
          });
          const existingUserIds = existingMembers.map((m) => m.userId);

          const toDelete = existingUserIds.filter(
            (id) => !state.memberIds.includes(id),
          );
          const toInsert = state.memberIds.filter(
            (id) => !existingUserIds.includes(id),
          );

          if (toDelete.length > 0) {
            await tx.communityMember.deleteMany({
              where: {
                communityId: state.id,
                userId: { in: toDelete },
              },
            });
          }

          if (toInsert.length > 0) {
            await tx.communityMember.createMany({
              data: toInsert.map((userId) => ({
                communityId: state.id,
                userId,
              })),
            });
          }
        })
        .then(() => undefined),
      (error) =>
        isUniqueConstraintViolation(error)
          ? domainError("SLUG_ALREADY_EXISTS")
          : domainError("SAVE_FAILED"),
    );
  }

  delete(id: string): ResultAsync<void, DomainError> {
    return ResultAsync.fromPromise(
      this.client.community.delete({ where: { id } }).then(() => undefined),
      (error) =>
        isRecordNotFound(error)
          ? domainError("NOT_FOUND")
          : domainError("SAVE_FAILED"),
    );
  }
}

function isRecordNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2025"
  );
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}
