"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export type BetActionState = { error?: string; success?: boolean } | null;

export async function createBet(
  _prev: BetActionState,
  formData: FormData,
): Promise<BetActionState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const label = formData.get("label")?.toString().trim();
  if (!label) return { error: "Label is required" };

  await prisma.bet.create({
    data: { label, userId: session.user.id },
  });

  revalidatePath("/bets");
  return { success: true };
}
