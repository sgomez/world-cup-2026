"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { container } from "@/lib/container";
import { withAuthenticatedAction } from "./authenticated-action";

export type ProfileActionState = { error?: string; success?: boolean } | null;

export async function updateProfile(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  return withAuthenticatedAction(async (session) => {
    const name = formData.get("name")?.toString().trim() ?? "";
    const image = formData.get("image")?.toString().trim() || null;

    const result = await container.users().updateProfile({
      userId: session.user.id,
      name,
      image,
    });

    if (result.isErr()) {
      const t = await getTranslations("actionErrors");
      return { error: t(result.error.code as never) };
    }

    revalidatePath("/profile");
    revalidatePath("/");
    return { success: true };
  });
}
