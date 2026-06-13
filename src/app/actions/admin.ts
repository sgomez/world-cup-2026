"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { container } from "@/lib/container";
import { withAuthenticatedAction } from "./authenticated-action";

type Role = "user" | "admin" | "super_admin";

export type AdminActionState = { error?: string; success?: boolean } | null;

export async function setUserRole(
  targetUserId: string,
  newRole: Role,
): Promise<{ error?: string; success?: boolean }> {
  const result = await withAuthenticatedAction(async (session) => {
    const res = await container.users().changeRole({
      actorId: session.user.id,
      targetUserId,
      newRole,
    });

    if (res.isErr()) {
      const t = await getTranslations("actionErrors");
      return { error: t(res.error.code as never) };
    }

    revalidatePath("/admin");
    revalidatePath(`/admin/users/${targetUserId}`);
    return { success: true };
  });

  return result;
}
