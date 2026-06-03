"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export type BetActionState = { error?: string; success?: boolean } | null;

export type GroupOrders = Record<string, string[]>;
export type ThirdPlaceOrder = string[];

export type PredictionState = {
  groupOrders: GroupOrders;
  thirdPlaceOrder: ThirdPlaceOrder;
};

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
  state: PredictionState,
): Promise<BetActionState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const bet = await prisma.bet.findUnique({ where: { id: betId } });
  if (!bet) return { error: "Bet not found" };
  if (bet.userId !== session.user.id) return { error: "Not authorized" };

  await prisma.bet.update({
    where: { id: betId },
    data: { groupPredictions: state },
  });

  return { success: true };
}
