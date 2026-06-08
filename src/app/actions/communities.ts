"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { BET_DEADLINE } from "@/lib/bet-constants";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { PrismaBetRepository } from "@/modules/bet/infrastructure/prisma-bet-repository";
import { createCommunity as createCommunityUseCase } from "@/modules/community/application/create-community";
import { joinCommunity as joinCommunityUseCase } from "@/modules/community/application/join-community";
import { leaveCommunity as leaveCommunityUseCase } from "@/modules/community/application/leave-community";
import { removeMember as removeMemberUseCase } from "@/modules/community/application/remove-member";
import type { DomainErrorCode } from "@/modules/community/domain/errors";
import { PrismaCommunityRepository } from "@/modules/community/infrastructure/prisma-community-repository";

async function communityErrorMessage(code: DomainErrorCode): Promise<string> {
  const t = await getTranslations("communityErrors");
  return t(code);
}

export type CommunityActionState = { error?: string; success?: boolean } | null;
export type JoinCommunityState = { error?: string } | null;

export async function createCommunity(
  _prev: CommunityActionState,
  formData: FormData,
): Promise<CommunityActionState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const name = formData.get("name")?.toString().trim();
  if (!name) return { error: "Name is required" };

  const repo = new PrismaCommunityRepository(prisma);
  const inviteToken = randomBytes(32).toString("hex");

  const result = await createCommunityUseCase(repo, {
    ownerId: session.user.id,
    name,
    inviteToken,
  });

  if (result.isErr()) {
    if (result.error.code === "SLUG_ALREADY_EXISTS") {
      return createCommunity(_prev, formData);
    }
    return { error: await communityErrorMessage(result.error.code) };
  }

  const community = result.value;
  const locale = await getLocale();
  revalidatePath("/communities");
  redirect({ href: `/communities/${community.slug}`, locale });
}

export async function getCommunity(slug: string) {
  const session = await getSession();
  if (!session) return null;

  const isPastDeadline = BET_DEADLINE.getTime() < Date.now();

  const community = await prisma.community.findUnique({
    where: { slug },
    include: {
      owner: { select: { name: true } },
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!community) return null;

  const isMember = community.members.some((m) => m.userId === session.user.id);
  if (!isMember) return null;

  const userIds = community.members.map((m) => m.user.id);
  const repo = new PrismaBetRepository(prisma);
  const allBets = await repo.listByOwners(userIds);

  const betsByUserId = new Map<string, typeof allBets>();
  for (const bet of allBets) {
    const list = betsByUserId.get(bet.userId) ?? [];
    list.push(bet);
    betsByUserId.set(bet.userId, list);
  }

  const members = community.members.map((m) => {
    const userBets = betsByUserId.get(m.user.id) ?? [];
    const bets = userBets
      .filter((b) => isPastDeadline || b.status === "closed")
      .map((b) => {
        const state = b.toState();
        return {
          id: state.id,
          label: state.label,
          status: state.status,
          createdAt: state.createdAt ?? new Date(),
          updatedAt: state.updatedAt ?? new Date(),
          signature: b.signature,
        };
      });
    return { ...m, user: { ...m.user, bets } };
  });

  return {
    ...community,
    members,
    currentUserId: session.user.id,
    isPastDeadline,
  };
}

export async function leaveCommunity(
  slug: string,
  _prev: CommunityActionState,
  _formData: FormData,
): Promise<CommunityActionState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const repo = new PrismaCommunityRepository(prisma);
  const result = await leaveCommunityUseCase(repo, {
    userId: session.user.id,
    slug,
  });

  if (result.isErr()) {
    return { error: await communityErrorMessage(result.error.code) };
  }

  const locale = await getLocale();
  revalidatePath("/communities");
  redirect({ href: "/communities", locale });
}

export async function removeMember(
  slug: string,
  targetUserId: string,
  _prev: CommunityActionState,
  _formData: FormData,
): Promise<CommunityActionState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const repo = new PrismaCommunityRepository(prisma);
  const result = await removeMemberUseCase(repo, {
    actorId: session.user.id,
    targetUserId,
    slug,
  });

  if (result.isErr()) {
    return { error: await communityErrorMessage(result.error.code) };
  }

  revalidatePath(`/communities/${slug}/settings`);
  revalidatePath(`/communities/${slug}`);
  return { success: true };
}

export async function deleteCommunity(
  slug: string,
  _prev: CommunityActionState,
  _formData: FormData,
): Promise<CommunityActionState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const community = await prisma.community.findUnique({ where: { slug } });
  if (!community) return { error: "Community not found" };

  if (community.ownerId !== session.user.id) {
    return { error: "Only the owner can delete the community" };
  }

  await prisma.community.delete({ where: { id: community.id } });

  const locale = await getLocale();
  revalidatePath("/communities");
  redirect({ href: "/communities", locale });
}

export async function regenerateInviteToken(
  slug: string,
  _prev: CommunityActionState,
  _formData: FormData,
): Promise<CommunityActionState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const community = await prisma.community.findUnique({ where: { slug } });
  if (!community) return { error: "Community not found" };

  if (community.ownerId !== session.user.id) {
    return { error: "Only the owner can regenerate the invite link" };
  }

  const newToken = randomBytes(32).toString("hex");
  await prisma.community.update({
    where: { id: community.id },
    data: { inviteToken: newToken },
  });

  revalidatePath(`/communities/${slug}/settings`);
  return { success: true };
}

export async function joinCommunity(
  token: string,
  _prev: JoinCommunityState,
  _formData: FormData,
): Promise<JoinCommunityState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const repo = new PrismaCommunityRepository(prisma);
  const result = await joinCommunityUseCase(repo, {
    userId: session.user.id,
    inviteToken: token,
  });

  if (result.isErr()) {
    return { error: await communityErrorMessage(result.error.code) };
  }

  const locale = await getLocale();
  revalidatePath("/communities");
  redirect({ href: `/communities/${result.value.slug}`, locale });
}
