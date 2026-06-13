"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { container } from "@/lib/container";
import { prisma } from "@/lib/prisma";
import { getSession, requireAdmin } from "@/lib/session";
import type { DomainErrorCode } from "@/modules/community/domain/errors";
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

    const inviteToken = randomBytes(32).toString("hex");

    const result = await container.communities().create({
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

  return {
    ...community,
    currentUserId: session.user.id,
  };
}

export async function leaveCommunity(
  slug: string,
  _prev: CommunityActionState,
  _formData: FormData,
): Promise<CommunityActionState> {
  return withAuthenticatedAction(async (session) => {
    const result = await container.communities().leave({
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
    const result = await container.communities().removeMember({
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
    const result = await container.communities().delete({
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
    const newToken = randomBytes(32).toString("hex");
    const result = await container.communities().regenerateInviteToken({
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
    const result = await container.communities().join({
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

  const inviteToken = randomBytes(32).toString("hex");

  class TransactionRollbackError extends Error {
    constructor(public readonly domainError: { code: string }) {
      super(`Rollback: ${domainError.code}`);
    }
  }

  try {
    const result = await container.transaction(async (txContainer) => {
      const res = await txContainer.bets().importDirect({
        mode,
        communityId: mode === "reuse" ? communityId : undefined,
        communityName: mode === "create" ? communityName : undefined,
        fileBuffer,
        inviteToken,
      });

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
