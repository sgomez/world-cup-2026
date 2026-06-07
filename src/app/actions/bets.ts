"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { BET_DEADLINE, MAX_BETS_PER_USER } from "@/lib/bet-constants";
import type { PredictionState, TournamentState } from "@/lib/prediction-state";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export type { PredictionState } from "@/lib/prediction-state";
export type BetActionState = { error?: string; success?: boolean } | null;

async function getBetForOwner(betId: string, userId: string) {
  const bet = await prisma.bet.findUnique({ where: { id: betId } });
  if (!bet) return { error: "Bet not found" as const };
  if (bet.userId !== userId) return { error: "Not authorized" as const };
  return { bet };
}

export async function createBet(
  _prev: BetActionState,
  formData: FormData,
): Promise<BetActionState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  if (new Date() > BET_DEADLINE) return { error: "Deadline passed" };

  const label = formData.get("label")?.toString().trim();
  if (!label) return { error: "Label is required" };
  if (label.length > 200) return { error: "Label too long (max 200 chars)" };

  const betCount = await prisma.bet.count({
    where: { userId: session.user.id },
  });
  if (betCount >= MAX_BETS_PER_USER) return { error: "Bet limit reached" };

  const bet = await prisma.bet.create({
    data: { label, userId: session.user.id },
  });

  const locale = await getLocale();
  revalidatePath("/bets");
  redirect({ href: `/bets/${bet.id}`, locale });
}

export async function removeBet(betId: string): Promise<BetActionState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const bet = await prisma.bet.findUnique({ where: { id: betId } });
  if (!bet) return { error: "Not found" };
  if (bet.userId !== session.user.id) return { error: "Not authorized" };
  if (Date.now() >= BET_DEADLINE.getTime()) return { error: "Deadline passed" };

  await prisma.bet.delete({ where: { id: betId } });
  revalidatePath("/bets");
  return { success: true };
}

export async function closeBet(betId: string): Promise<BetActionState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const result = await getBetForOwner(betId, session.user.id);
  if ("error" in result) return { error: result.error };

  if (BET_DEADLINE.getTime() < Date.now())
    return { error: "Deadline has passed" };

  const knockoutWinners = result.bet.knockoutWinners as Record<
    string,
    string
  > | null;
  const count = knockoutWinners ? Object.keys(knockoutWinners).length : 0;
  if (count < 32) {
    return { error: "Predictions are incomplete" };
  }

  await prisma.bet.update({ where: { id: betId }, data: { status: "closed" } });
  revalidatePath(`/bets/${betId}`);
  revalidatePath("/bets");
  return { success: true };
}

export async function reopenBet(betId: string): Promise<BetActionState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const result = await getBetForOwner(betId, session.user.id);
  if ("error" in result) return { error: result.error };

  if (BET_DEADLINE.getTime() < Date.now())
    return { error: "Deadline has passed" };

  await prisma.bet.update({ where: { id: betId }, data: { status: "draft" } });
  revalidatePath(`/bets/${betId}`);
  revalidatePath("/bets");
  return { success: true };
}

export async function copyBet(betId: string): Promise<BetActionState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const source = await prisma.bet.findUnique({ where: { id: betId } });
  if (!source) return { error: "Bet not found" };
  if (source.userId !== session.user.id) return { error: "Not authorized" };

  if (Date.now() >= BET_DEADLINE.getTime())
    return { error: "Bet deadline has passed" };

  const count = await prisma.bet.count({ where: { userId: session.user.id } });
  if (count >= MAX_BETS_PER_USER) return { error: "Bet limit reached" };

  const rawLabel = `Copy of ${source.label}`;
  const label = rawLabel.slice(0, 200);

  const newBet = await prisma.bet.create({
    data: {
      label,
      userId: session.user.id,
      status: "draft",
      groupPredictions: source.groupPredictions ?? undefined,
      knockoutWinners: source.knockoutWinners ?? undefined,
    },
  });

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

  const bet = await prisma.bet.findUnique({ where: { id: betId } });
  if (!bet) return { error: "Bet not found" };
  if (bet.userId !== session.user.id) return { error: "Not authorized" };
  if (bet.status === "closed") return { error: "Bet is closed" };

  const groupPredictions: PredictionState = {
    groupOrders: state.groupOrders,
    thirdPlaceOrder: state.thirdPlaceOrder,
  };

  const knockoutWinners: Record<string, string> = {};
  for (const [matchId, match] of Object.entries(state.knockoutMatches)) {
    if (match.winnerId) knockoutWinners[matchId] = match.winnerId;
  }

  await prisma.bet.update({
    where: { id: betId },
    data: { groupPredictions, knockoutWinners },
  });

  return { success: true };
}

export async function renameBet(
  betId: string,
  label: string,
): Promise<BetActionState> {
  const session = await getSession();
  if (!session) {
    throw new Error("Not authenticated");
  }

  const trimmedLabel = label?.trim();
  if (!trimmedLabel || trimmedLabel.length > 200) {
    throw new Error("Label must be between 1 and 200 characters");
  }

  const bet = await prisma.bet.findUnique({ where: { id: betId } });
  if (!bet) {
    throw new Error("Bet not found");
  }

  if (bet.userId !== session.user.id) {
    throw new Error("Not authorized");
  }

  if (bet.status !== "draft") {
    throw new Error("Bet is closed");
  }

  if (Date.now() >= BET_DEADLINE.getTime()) {
    throw new Error("Deadline passed");
  }

  await prisma.bet.update({
    where: { id: betId },
    data: { label: trimmedLabel },
  });

  revalidatePath(`/bets/${betId}`);
  revalidatePath("/bets");

  return { success: true };
}
