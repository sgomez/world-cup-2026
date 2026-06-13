"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { changeRole as changeRoleUseCase } from "@/modules/user/application/change-role";
import { PrismaUserRepository } from "@/modules/user/infrastructure/prisma-user-repository";
import { withAuthenticatedAction } from "./authenticated-action";

type Role = "user" | "admin" | "super_admin";

export type AdminActionState = { error?: string; success?: boolean } | null;

export async function setUserRole(
  targetUserId: string,
  newRole: Role,
): Promise<{ error?: string; success?: boolean }> {
  const result = await withAuthenticatedAction(async (session) => {
    const repo = new PrismaUserRepository(prisma);
    const res = await changeRoleUseCase(repo, {
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
