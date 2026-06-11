"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import type { DomainErrorCode } from "@/modules/tournament/domain/errors";
import { Tournament } from "@/modules/tournament/domain/tournament";
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

/**
 * Stores a per-group manual tie-break ordering.
 * Used when the automatic standings engine leaves teams tied and the Admin
 * must supply the terminal ordering (fair-play, lots).
 */
export async function setManualTieBreakAction(
  group: string,
  orderedIds: string[],
): Promise<TournamentActionState> {
  return withAuthenticatedAction(async (session) => {
    if (session.user.role !== "admin" && session.user.role !== "super_admin") {
      return {
        error: await tournamentErrorMessage("FORBIDDEN"),
      };
    }

    const repo = new PrismaTournamentRepository(prisma);
    const existing = await repo.get();
    const tournament = existing ?? Tournament.createDefault();
    const factors: Record<string, number> = {};
    orderedIds.forEach((id, idx) => {
      factors[id] = orderedIds.length - idx;
    });
    const updated = tournament
      .setManualTieBreak(group, factors)
      ._unsafeUnwrap();
    const saveResult = await repo.save(updated);

    if (saveResult.isErr()) {
      return {
        error: await tournamentErrorMessage(saveResult.error.code),
      };
    }

    revalidatePath("/admin/result");
    revalidatePath("/standings");
    return { success: true };
  });
}

/**
 * Clears a per-group manual tie-break.
 */
export async function clearManualTieBreakAction(
  group: string,
): Promise<TournamentActionState> {
  return withAuthenticatedAction(async (session) => {
    if (session.user.role !== "admin" && session.user.role !== "super_admin") {
      return {
        error: await tournamentErrorMessage("FORBIDDEN"),
      };
    }

    const repo = new PrismaTournamentRepository(prisma);
    const existing = await repo.get();
    const tournament = existing ?? Tournament.createDefault();
    const updated = tournament.clearManualTieBreak(group)._unsafeUnwrap();
    const saveResult = await repo.save(updated);

    if (saveResult.isErr()) {
      return {
        error: await tournamentErrorMessage(saveResult.error.code),
      };
    }

    revalidatePath("/admin/result");
    revalidatePath("/standings");
    return { success: true };
  });
}

/**
 * Sets the manual order for the cross-group thirds ranking.
 */
export async function setThirdPlaceManualOrderAction(
  orderedIds: string[] | null,
): Promise<TournamentActionState> {
  return withAuthenticatedAction(async (session) => {
    if (session.user.role !== "admin" && session.user.role !== "super_admin") {
      return {
        error: await tournamentErrorMessage("FORBIDDEN"),
      };
    }

    const repo = new PrismaTournamentRepository(prisma);
    const existing = await repo.get();
    const tournament = existing ?? Tournament.createDefault();
    let factors: Record<string, number> | null = null;
    if (orderedIds) {
      factors = {};
      orderedIds.forEach((id, idx) => {
        factors![id] = orderedIds.length - idx;
      });
    }
    const updated = tournament
      .setThirdPlaceManualOrder(factors)
      ._unsafeUnwrap();
    const saveResult = await repo.save(updated);

    if (saveResult.isErr()) {
      return {
        error: await tournamentErrorMessage(saveResult.error.code),
      };
    }

    revalidatePath("/admin/result");
    revalidatePath("/standings");
    return { success: true };
  });
}
