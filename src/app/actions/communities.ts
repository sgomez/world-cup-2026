"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export type CommunityActionState = { error?: string; success?: boolean } | null;

function deriveSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function uniqueSlug(base: string): Promise<string> {
  const existing = await prisma.community.findUnique({ where: { slug: base } });
  if (!existing) return base;

  let counter = 2;
  while (true) {
    const candidate = `${base}-${counter}`;
    const taken = await prisma.community.findUnique({
      where: { slug: candidate },
    });
    if (!taken) return candidate;
    counter++;
  }
}

export async function createCommunity(
  _prev: CommunityActionState,
  formData: FormData,
): Promise<CommunityActionState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const name = formData.get("name")?.toString().trim();
  if (!name) return { error: "Name is required" };

  const base = deriveSlug(name);
  const slug = await uniqueSlug(base);
  const inviteToken = randomBytes(32).toString("hex");

  await prisma.community.create({
    data: {
      name,
      slug,
      ownerId: session.user.id,
      inviteToken,
      members: {
        create: { userId: session.user.id },
      },
    },
  });

  revalidatePath("/communities");
  redirect("/communities");
}
