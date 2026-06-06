"use server";

import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export type CommunityActionState = { error?: string; success?: boolean } | null;
export type JoinCommunityState = { error?: string } | null;

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
  if (!base) return { error: "Name must contain at least one letter or digit" };

  const slug = await uniqueSlug(base);
  const inviteToken = randomBytes(32).toString("hex");

  let community: { id: string; slug: string };
  try {
    community = await prisma.community.create({
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
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return createCommunity(_prev, formData);
    }
    throw e;
  }

  revalidatePath("/communities");
  redirect(`/communities/${community.slug}`);
}

export async function getCommunity(slug: string) {
  const session = await getSession();
  if (!session) return null;

  const community = await prisma.community.findUnique({
    where: { slug },
    include: {
      owner: { select: { name: true } },
      members: { include: { user: { select: { id: true, name: true } } } },
    },
  });

  if (!community) return null;

  const isMember = community.members.some((m) => m.userId === session.user.id);
  if (!isMember) return null;

  return { ...community, currentUserId: session.user.id };
}

export async function joinCommunity(
  token: string,
  _prev: JoinCommunityState,
  _formData: FormData,
): Promise<JoinCommunityState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const community = await prisma.community.findUnique({
    where: { inviteToken: token },
  });

  if (!community) return { error: "Invalid or expired invite link" };

  await prisma.communityMember.upsert({
    where: {
      communityId_userId: {
        communityId: community.id,
        userId: session.user.id,
      },
    },
    create: { communityId: community.id, userId: session.user.id },
    update: {},
  });

  revalidatePath("/communities");
  redirect(`/communities/${community.slug}`);
}
