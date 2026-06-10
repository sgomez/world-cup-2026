"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { clearKnockoutResult as clearKnockoutResultUseCase } from "@/modules/tournament/application/clear-knockout-result";
import { markAdvanced as markAdvancedUseCase } from "@/modules/tournament/application/mark-advanced";
import { setGroupResult as setGroupResultUseCase } from "@/modules/tournament/application/set-group-result";
import { setKnockoutResult as setKnockoutResultUseCase } from "@/modules/tournament/application/set-knockout-result";
import { setThirdPlaceResult as setThirdPlaceResultUseCase } from "@/modules/tournament/application/set-third-place-result";
import { unmarkAdvanced as unmarkAdvancedUseCase } from "@/modules/tournament/application/unmark-advanced";
import type { DomainErrorCode } from "@/modules/tournament/domain/errors";
import { PrismaTournamentRepository } from "@/modules/tournament/infrastructure/prisma-tournament-repository";
import { withAuthenticatedAction } from "./authenticated-action";

async function tournamentErrorMessage(code: DomainErrorCode): Promise<string> {
  const t = await getTranslations("tournamentErrors");
  return t(code);
}

export type TournamentActionState = {
  error?: string;
  success?: boolean;
} | null;

export async function setGroupResultAction(
  group: string,
  orderedIds: string[],
): Promise<TournamentActionState> {
  return withAuthenticatedAction(async (session) => {
    const repo = new PrismaTournamentRepository(prisma);
    const result = await setGroupResultUseCase(repo, {
      actorRole: session.user.role ?? "user",
      group,
      orderedIds,
    });

    if (result.isErr()) {
      return { error: await tournamentErrorMessage(result.error.code) };
    }

    revalidatePath("/admin/result");
    revalidatePath("/standings");
    return { success: true };
  });
}

export async function setThirdPlaceResultAction(
  orderedIds: string[],
): Promise<TournamentActionState> {
  return withAuthenticatedAction(async (session) => {
    const repo = new PrismaTournamentRepository(prisma);
    const result = await setThirdPlaceResultUseCase(repo, {
      actorRole: session.user.role ?? "user",
      orderedIds,
    });

    if (result.isErr()) {
      return { error: await tournamentErrorMessage(result.error.code) };
    }

    revalidatePath("/admin/result");
    revalidatePath("/standings");
    return { success: true };
  });
}

export async function markAdvancedAction(
  ref: string,
): Promise<TournamentActionState> {
  return withAuthenticatedAction(async (session) => {
    const repo = new PrismaTournamentRepository(prisma);
    const result = await markAdvancedUseCase(repo, {
      actorRole: session.user.role ?? "user",
      ref,
    });

    if (result.isErr()) {
      return { error: await tournamentErrorMessage(result.error.code) };
    }

    revalidatePath("/admin/result");
    revalidatePath("/standings");
    return { success: true };
  });
}

export async function unmarkAdvancedAction(
  ref: string,
): Promise<TournamentActionState> {
  return withAuthenticatedAction(async (session) => {
    const repo = new PrismaTournamentRepository(prisma);
    const result = await unmarkAdvancedUseCase(repo, {
      actorRole: session.user.role ?? "user",
      ref,
    });

    if (result.isErr()) {
      return { error: await tournamentErrorMessage(result.error.code) };
    }

    revalidatePath("/admin/result");
    revalidatePath("/standings");
    return { success: true };
  });
}

export async function setKnockoutResultAction(
  matchId: string,
  winnerId: string,
): Promise<TournamentActionState> {
  return withAuthenticatedAction(async (session) => {
    const repo = new PrismaTournamentRepository(prisma);
    const result = await setKnockoutResultUseCase(repo, {
      actorRole: session.user.role ?? "user",
      matchId,
      winnerId,
    });

    if (result.isErr()) {
      return { error: await tournamentErrorMessage(result.error.code) };
    }

    revalidatePath("/admin/result");
    revalidatePath("/standings");
    return { success: true };
  });
}

export async function clearKnockoutResultAction(
  matchId: string,
): Promise<TournamentActionState> {
  return withAuthenticatedAction(async (session) => {
    const repo = new PrismaTournamentRepository(prisma);
    const result = await clearKnockoutResultUseCase(repo, {
      actorRole: session.user.role ?? "user",
      matchId,
    });

    if (result.isErr()) {
      return { error: await tournamentErrorMessage(result.error.code) };
    }

    revalidatePath("/admin/result");
    revalidatePath("/standings");
    return { success: true };
  });
}
