"use server";

import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { MAX_BETS_PER_USER } from "@/lib/bet-constants";
import { container } from "@/lib/container";
import type { DomainErrorCode } from "@/modules/bet/domain/errors";
import type { TournamentState } from "@/modules/bracket";
import { withAuthenticatedAction } from "./authenticated-action";

async function betErrorMessage(code: DomainErrorCode): Promise<string> {
  const t = await getTranslations("betErrors");
  return t(code);
}

export type { PredictionState } from "@/modules/bracket";
export type BetActionState = { error?: string; success?: boolean } | null;

export async function createBet(
  _prev: BetActionState,
  formData: FormData,
): Promise<BetActionState> {
  return withAuthenticatedAction(async (session) => {
    const label = formData.get("label")?.toString().trim() ?? "";

    const result = await container.bets().create({
      userId: session.user.id,
      label,
      limit: MAX_BETS_PER_USER,
    });

    if (result.isErr()) {
      return { error: await betErrorMessage(result.error.code) };
    }

    const bet = result.value;
    const locale = await getLocale();
    revalidatePath("/bets");
    redirect({ href: `/bets/${bet.id}`, locale });
  });
}

export async function removeBet(betId: string): Promise<BetActionState> {
  return withAuthenticatedAction(async (session) => {
    const result = await container.bets().remove({
      betId,
      userId: session.user.id,
    });

    if (result.isErr()) {
      return { error: await betErrorMessage(result.error.code) };
    }

    revalidatePath("/bets");
    return { success: true };
  });
}

export async function closeBet(betId: string): Promise<BetActionState> {
  return withAuthenticatedAction(async (session) => {
    const result = await container.bets().close({
      betId,
      userId: session.user.id,
    });

    if (result.isErr()) {
      return { error: await betErrorMessage(result.error.code) };
    }

    revalidatePath(`/bets/${betId}`);
    revalidatePath("/bets");
    return { success: true };
  });
}

export async function reopenBet(betId: string): Promise<BetActionState> {
  return withAuthenticatedAction(async (session) => {
    const result = await container.bets().reopen({
      betId,
      userId: session.user.id,
    });

    if (result.isErr()) {
      return { error: await betErrorMessage(result.error.code) };
    }

    revalidatePath(`/bets/${betId}`);
    revalidatePath("/bets");
    return { success: true };
  });
}

export async function copyBet(betId: string): Promise<BetActionState> {
  return withAuthenticatedAction(async (session) => {
    const result = await container.bets().copy({
      betId,
      userId: session.user.id,
      limit: MAX_BETS_PER_USER,
    });

    if (result.isErr()) {
      return { error: await betErrorMessage(result.error.code) };
    }

    const newBet = result.value;
    const locale = await getLocale();
    revalidatePath("/bets");
    redirect({ href: `/bets/${newBet.id}`, locale });
  });
}

export async function updateBetPredictions(
  betId: string,
  state: TournamentState,
): Promise<BetActionState> {
  return withAuthenticatedAction(async (session) => {
    const groupPredictions = {
      groupOrders: state.groupOrders,
      thirdPlaceOrder: state.thirdPlaceOrder,
    };

    const knockoutWinners: Record<string, string> = {};
    for (const [matchId, match] of Object.entries(state.knockoutMatches)) {
      if (match.winnerId) knockoutWinners[matchId] = match.winnerId;
    }

    const result = await container.bets().updatePredictions({
      betId,
      userId: session.user.id,
      groupPredictions,
      knockoutWinners,
    });

    if (result.isErr()) {
      return { error: await betErrorMessage(result.error.code) };
    }

    return { success: true };
  });
}

export async function renameBet(
  betId: string,
  label: string,
): Promise<BetActionState> {
  return withAuthenticatedAction(async (session) => {
    const result = await container.bets().rename({
      betId,
      userId: session.user.id,
      label,
    });

    if (result.isErr()) {
      return { error: await betErrorMessage(result.error.code) };
    }

    revalidatePath(`/bets/${betId}`);
    revalidatePath("/bets");
    return { success: true };
  });
}
