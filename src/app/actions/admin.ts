"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

type Role = "user" | "admin" | "super_admin";

export async function setUserRole(
  targetUserId: string,
  newRole: Role,
): Promise<void> {
  const session = await getSession();
  if (!session) return;

  const actor = session.user;
  const actorRole = actor.role;

  if (actorRole !== "admin" && actorRole !== "super_admin") return;
  if (actor.id === targetUserId) return;

  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target || target.role === "super_admin") return;

  await prisma.user.update({
    where: { id: targetUserId },
    data: { role: newRole },
  });

  revalidatePath("/admin");
  revalidatePath(`/admin/users/${targetUserId}`);
}
