"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { BET_DEADLINE } from "@/lib/bet-constants";
import { prisma } from "@/lib/prisma";
import { getSession, requireAdmin } from "@/lib/session";
import { importDirectBets } from "@/modules/bet/application/import-direct-bets";
import { BettingWindow } from "@/modules/bet/domain/betting-window";
import { ExceljsSheetParser } from "@/modules/bet/infrastructure/exceljs-sheet-parser";
import { PrismaBetRepository } from "@/modules/bet/infrastructure/prisma-bet-repository";
import { createCommunity as createCommunityUseCase } from "@/modules/community/application/create-community";
import { deleteCommunity as deleteCommunityUseCase } from "@/modules/community/application/delete-community";
import { joinCommunity as joinCommunityUseCase } from "@/modules/community/application/join-community";
import { leaveCommunity as leaveCommunityUseCase } from "@/modules/community/application/leave-community";
import { regenerateInviteToken as regenerateInviteTokenUseCase } from "@/modules/community/application/regenerate-invite-token";
import { removeMember as removeMemberUseCase } from "@/modules/community/application/remove-member";
import type { DomainErrorCode } from "@/modules/community/domain/errors";
import { PrismaCommunityRepository } from "@/modules/community/infrastructure/prisma-community-repository";
import { PrismaImportOwnerProvisioner } from "@/modules/community/infrastructure/prisma-import-owner-provisioner";
import { getLeaderboard } from "@/modules/leaderboard/application/get-leaderboard";
import { PrismaLiveResultRepository } from "@/modules/live/infrastructure/prisma-live-result-repository";
import { PrismaTournamentRepository } from "@/modules/tournament/infrastructure/prisma-tournament-repository";
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

  const communityRepo = new PrismaCommunityRepository(prisma);
  const betRepo = new PrismaBetRepository(prisma);
  const tournamentRepo = new PrismaTournamentRepository(prisma);
  const liveResultRepo = new PrismaLiveResultRepository(prisma);

  const getUserName = async (userId: string) => {
    const m = community.members.find((mem) => mem.userId === userId);
    return m?.user.name ?? null;
  };

  const leaderboardResult = await getLeaderboard(
    communityRepo,
    betRepo,
    tournamentRepo,
    liveResultRepo,
    getUserName,
    {
      viewerId: session.user.id,
      communitySlug: slug,
      window,
      now,
    },
  );

  if (leaderboardResult.isErr()) {
    return null;
  }

  const leaderboard = leaderboardResult.value;

  const members = community.members.map((m) => {
    const userEntries = leaderboard.entries.filter(
      (e) => e.userId === m.user.id,
    );
    const bets = userEntries.map((e) => ({
      id: e.betId,
      label: e.betName,
      status: e.bet ? e.bet.status : "closed",
      signature: e.signature,
    }));
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

export type ImportDirectBetsActionState = {
  error?: string;
  success?: boolean;
  communitySlug?: string;
  skippedRows?: { rowNumber: number; reason: string }[];
} | null;

export async function importDirectBetsAction(
  _prev: ImportDirectBetsActionState,
  formData: FormData,
): Promise<ImportDirectBetsActionState> {
  await requireAdmin();

  const mode =
    (formData.get("mode")?.toString() as "create" | "reuse") || "create";
  const communityId = formData.get("communityId")?.toString() || "";
  const communityName = formData.get("communityName")?.toString().trim() ?? "";

  const t = await getTranslations("admin");

  if (mode === "create" && !communityName) {
    return {
      error: t("importErrorInvalidSheet") || "Community name is required",
    };
  }

  if (mode === "reuse" && !communityId) {
    return {
      error: t("importErrorInvalidSheet") || "Community selection is required",
    };
  }

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    return { error: t("importErrorInvalidSheet") || "Excel file is required" };
  }

  let fileBuffer: Buffer;
  try {
    const arrayBuffer = await file.arrayBuffer();
    fileBuffer = Buffer.from(arrayBuffer);
  } catch (_err) {
    return { error: t("importErrorInvalidSheet") };
  }

  const sheetParser = new ExceljsSheetParser();
  const inviteToken = randomBytes(32).toString("hex");

  class TransactionRollbackError extends Error {
    constructor(public readonly domainError: { code: string }) {
      super(`Rollback: ${domainError.code}`);
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // biome-ignore lint/suspicious/noExplicitAny: Prisma transaction client typecasting
      const txCommunityRepo = new PrismaCommunityRepository(tx as any);
      // biome-ignore lint/suspicious/noExplicitAny: Prisma transaction client typecasting
      const txBetRepo = new PrismaBetRepository(tx as any);
      // biome-ignore lint/suspicious/noExplicitAny: Prisma transaction client typecasting
      const txOwnerProvisioner = new PrismaImportOwnerProvisioner(tx as any);

      const res = await importDirectBets(
        sheetParser,
        txOwnerProvisioner,
        txCommunityRepo,
        txBetRepo,
        {
          mode,
          communityId: mode === "reuse" ? communityId : undefined,
          communityName: mode === "create" ? communityName : undefined,
          fileBuffer,
          inviteToken,
        },
      );

      if (res.isErr()) {
        throw new TransactionRollbackError(res.error);
      }

      return res.value;
    });

    revalidatePath("/admin");
    revalidatePath("/communities");

    return {
      success: true,
      communitySlug: result.community.slug,
      skippedRows: result.skippedRows.map((sr) => ({
        rowNumber: sr.rowNumber,
        reason: sr.reason,
      })),
    };
  } catch (error) {
    if (error instanceof TransactionRollbackError) {
      const code = error.domainError.code;
      const tBet = await getTranslations("betErrors");
      const tComm = await getTranslations("communityErrors");

      let errorMsg = "";
      if (code === "INVALID_SHEET") {
        errorMsg = tBet("INVALID_SHEET");
      } else {
        errorMsg = tComm(code as never) || tBet(code as never) || code;
      }
      return { error: errorMsg };
    }

    const t = await getTranslations("admin");
    return {
      error: t("importErrorInvalidSheet") || "Failed to parse Excel sheet",
    };
  }
}
