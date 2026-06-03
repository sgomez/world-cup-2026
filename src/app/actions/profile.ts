"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export type ProfileActionState = { error?: string; success?: boolean } | null;

export async function updateProfile(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const name = formData.get("name")?.toString().trim();
  const image = formData.get("image")?.toString().trim() || null;

  if (!name) return { error: "Name is required" };

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name, image },
  });

  revalidatePath("/profile");
  revalidatePath("/");
  return { success: true };
}
