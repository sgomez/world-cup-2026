"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { withAuthenticatedAction } from "./authenticated-action";

export type ProfileActionState = { error?: string; success?: boolean } | null;

export async function updateProfile(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  return withAuthenticatedAction(async (session) => {
    const name = formData.get("name")?.toString().trim();
    const image = formData.get("image")?.toString().trim() || null;

    if (!name) {
      const t = await getTranslations("actionErrors");
      return { error: t("NAME_REQUIRED") };
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { name, image },
    });

    revalidatePath("/profile");
    revalidatePath("/");
    return { success: true };
  });
}
