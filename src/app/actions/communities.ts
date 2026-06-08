"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { BET_DEADLINE } from "@/lib/bet-constants";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { peerSummariesByOwners } from "@/modules/bet/application/peer-summaries-by-owners";
import { BettingWindow } from "@/modules/bet/domain/betting-window";
import { PrismaBetRepository } from "@/modules/bet/infrastructure/prisma-bet-repository";
import { createCommunity as createCommunityUseCase } from "@/modules/community/application/create-community";
import { deleteCommunity as deleteCommunityUseCase } from "@/modules/community/application/delete-community";
import { joinCommunity as joinCommunityUseCase } from "@/modules/community/application/join-community";
import { leaveCommunity as leaveCommunityUseCase } from "@/modules/community/application/leave-community";
import { regenerateInviteToken as regenerateInviteTokenUseCase } from "@/modules/community/application/regenerate-invite-token";
import { removeMember as removeMemberUseCase } from "@/modules/community/application/remove-member";
import type { DomainErrorCode } from "@/modules/community/domain/errors";
import { PrismaCommunityRepository } from "@/modules/community/infrastructure/prisma-community-repository";
import { withAuthenticatedAction } from "./authenticated-action";

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
  return withAuthenticatedAction(async (session) => {
    const name = formData.get("name")?.toString().trim() ?? "";

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
  });
}

export async function getCommunity(slug: string) {
  const session = await getSession();
  if (!session) return null;

  const now = new Date();
  const window = new BettingWindow(BET_DEADLINE);

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
  const betSummaries = await peerSummariesByOwners(repo, userIds, window, now);

  const members = community.members.map((m) => {
    const bets = betSummaries.get(m.user.id) ?? [];
    return { ...m, user: { ...m.user, bets } };
  });

  return {
    ...community,
    members,
    currentUserId: session.user.id,
  };
}

export async function leaveCommunity(
  slug: string,
  _prev: CommunityActionState,
  _formData: FormData,
): Promise<CommunityActionState> {
  return withAuthenticatedAction(async (session) => {
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
  });
}

export async function removeMember(
  slug: string,
  targetUserId: string,
  _prev: CommunityActionState,
  _formData: FormData,
): Promise<CommunityActionState> {
  return withAuthenticatedAction(async (session) => {
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
  });
}

export async function deleteCommunity(
  slug: string,
  _prev: CommunityActionState,
  _formData: FormData,
): Promise<CommunityActionState> {
  return withAuthenticatedAction(async (session) => {
    const repo = new PrismaCommunityRepository(prisma);
    const result = await deleteCommunityUseCase(repo, {
      actorId: session.user.id,
      slug,
    });

    if (result.isErr()) {
      return { error: await communityErrorMessage(result.error.code) };
    }

    const locale = await getLocale();
    revalidatePath("/communities");
    redirect({ href: "/communities", locale });
  });
}

export async function regenerateInviteToken(
  slug: string,
  _prev: CommunityActionState,
  _formData: FormData,
): Promise<CommunityActionState> {
  return withAuthenticatedAction(async (session) => {
    const repo = new PrismaCommunityRepository(prisma);
    const newToken = randomBytes(32).toString("hex");
    const result = await regenerateInviteTokenUseCase(repo, {
      actorId: session.user.id,
      slug,
      newToken,
    });

    if (result.isErr()) {
      return { error: await communityErrorMessage(result.error.code) };
    }

    revalidatePath(`/communities/${slug}/settings`);
    return { success: true };
  });
}

export async function joinCommunity(
  token: string,
  _prev: JoinCommunityState,
  _formData: FormData,
): Promise<JoinCommunityState> {
  return withAuthenticatedAction(async (session) => {
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
  });
}
