"use server";

import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { BET_DEADLINE, MAX_BETS_PER_USER } from "@/lib/bet-constants";
import type { TournamentState } from "@/lib/prediction-state";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { closeBet as closeBetUseCase } from "@/modules/bet/application/close-bet";
import { copyBet as copyBetUseCase } from "@/modules/bet/application/copy-bet";
import { createBet as createBetUseCase } from "@/modules/bet/application/create-bet";
import { removeBet as removeBetUseCase } from "@/modules/bet/application/remove-bet";
import { renameBet as renameBetUseCase } from "@/modules/bet/application/rename-bet";
import { reopenBet as reopenBetUseCase } from "@/modules/bet/application/reopen-bet";
import { updateBetPredictions as updateBetPredictionsUseCase } from "@/modules/bet/application/update-bet-predictions";
import { BettingWindow } from "@/modules/bet/domain/betting-window";
import type { DomainErrorCode } from "@/modules/bet/domain/errors";
import { PrismaBetRepository } from "@/modules/bet/infrastructure/prisma-bet-repository";

async function betErrorMessage(code: DomainErrorCode): Promise<string> {
  const t = await getTranslations("betErrors");
  return t(code);
}

export type { PredictionState } from "@/lib/prediction-state";
export type BetActionState = { error?: string; success?: boolean } | null;

export async function createBet(
  _prev: BetActionState,
  formData: FormData,
): Promise<BetActionState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const label = formData.get("label")?.toString().trim();
  if (!label) return { error: "Label is required" };

  const repo = new PrismaBetRepository(prisma);
  const result = await createBetUseCase(repo, {
    userId: session.user.id,
    label,
    limit: MAX_BETS_PER_USER,
    window: new BettingWindow(BET_DEADLINE),
    now: new Date(),
  });

  if (result.isErr()) {
    return { error: await betErrorMessage(result.error.code) };
  }

  const bet = result.value;
  const locale = await getLocale();
  revalidatePath("/bets");
  redirect({ href: `/bets/${bet.id}`, locale });
}

export async function removeBet(betId: string): Promise<BetActionState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const repo = new PrismaBetRepository(prisma);
  const result = await removeBetUseCase(repo, {
    betId,
    userId: session.user.id,
    window: new BettingWindow(BET_DEADLINE),
    now: new Date(),
  });

  if (result.isErr()) {
    return { error: await betErrorMessage(result.error.code) };
  }

  revalidatePath("/bets");
  return { success: true };
}

export async function closeBet(betId: string): Promise<BetActionState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const repo = new PrismaBetRepository(prisma);
  const result = await closeBetUseCase(repo, {
    betId,
    userId: session.user.id,
    window: new BettingWindow(BET_DEADLINE),
    now: new Date(),
  });

  if (result.isErr()) {
    return { error: await betErrorMessage(result.error.code) };
  }

  revalidatePath(`/bets/${betId}`);
  revalidatePath("/bets");
  return { success: true };
}

export async function reopenBet(betId: string): Promise<BetActionState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const repo = new PrismaBetRepository(prisma);
  const result = await reopenBetUseCase(repo, {
    betId,
    userId: session.user.id,
    window: new BettingWindow(BET_DEADLINE),
    now: new Date(),
  });

  if (result.isErr()) {
    return { error: await betErrorMessage(result.error.code) };
  }

  revalidatePath(`/bets/${betId}`);
  revalidatePath("/bets");
  return { success: true };
}

export async function copyBet(betId: string): Promise<BetActionState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const repo = new PrismaBetRepository(prisma);
  const result = await copyBetUseCase(repo, {
    betId,
    userId: session.user.id,
    limit: MAX_BETS_PER_USER,
    window: new BettingWindow(BET_DEADLINE),
    now: new Date(),
  });

  if (result.isErr()) {
    return { error: await betErrorMessage(result.error.code) };
  }

  const newBet = result.value;
  const locale = await getLocale();
  revalidatePath("/bets");
  redirect({ href: `/bets/${newBet.id}`, locale });
}

export async function updateBetPredictions(
  betId: string,
  state: TournamentState,
): Promise<BetActionState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const groupPredictions = {
    groupOrders: state.groupOrders,
    thirdPlaceOrder: state.thirdPlaceOrder,
  };

  const knockoutWinners: Record<string, string> = {};
  for (const [matchId, match] of Object.entries(state.knockoutMatches)) {
    if (match.winnerId) knockoutWinners[matchId] = match.winnerId;
  }

  const repo = new PrismaBetRepository(prisma);
  const result = await updateBetPredictionsUseCase(repo, {
    betId,
    userId: session.user.id,
    groupPredictions,
    knockoutWinners,
    window: new BettingWindow(BET_DEADLINE),
    now: new Date(),
  });

  if (result.isErr()) {
    return { error: await betErrorMessage(result.error.code) };
  }

  return { success: true };
}

export async function renameBet(
  betId: string,
  label: string,
): Promise<BetActionState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const repo = new PrismaBetRepository(prisma);
  const result = await renameBetUseCase(repo, {
    betId,
    userId: session.user.id,
    label,
    window: new BettingWindow(BET_DEADLINE),
    now: new Date(),
  });

  if (result.isErr()) {
    return { error: await betErrorMessage(result.error.code) };
  }

  revalidatePath(`/bets/${betId}`);
  revalidatePath("/bets");
  return { success: true };
}
