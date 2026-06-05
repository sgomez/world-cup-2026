"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PredictionState, TournamentState } from "@/lib/prediction-state";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

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
  if (label.length > 200) return { error: "Label too long (max 200 chars)" };

  const bet = await prisma.bet.create({
    data: { label, userId: session.user.id },
  });

  revalidatePath("/bets");
  redirect(`/bets/${bet.id}`);
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

  const groupPredictions: PredictionState = {
    groupOrders: state.groupOrders,
    thirdPlaceOrder: state.thirdPlaceOrder,
  };

  await prisma.bet.update({
    where: { id: betId },
    data: { groupPredictions },
  });

  return { success: true };
}
