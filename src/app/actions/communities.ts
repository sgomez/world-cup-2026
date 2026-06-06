"use server";

import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { BET_DEADLINE } from "@/lib/bet-constants";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export type CommunityActionState = { error?: string; success?: boolean } | null;
export type JoinCommunityState = { error?: string } | null;
export type MemberActionState = { error?: string; success?: boolean } | null;

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

  const isPastDeadline = BET_DEADLINE.getTime() < Date.now();

  const community = await prisma.community.findUnique({
    where: { slug },
    include: {
      owner: { select: { name: true } },
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              bets: {
                select: {
                  id: true,
                  label: true,
                  status: true,
                  createdAt: true,
                  updatedAt: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!community) return null;

  const isMember = community.members.some((m) => m.userId === session.user.id);
  if (!isMember) return null;

  const members = isPastDeadline
    ? community.members
    : community.members.map((m) => ({
        ...m,
        user: { ...m.user, bets: [] as typeof m.user.bets },
      }));

  return {
    ...community,
    members,
    currentUserId: session.user.id,
    isPastDeadline,
  };
}

export async function leaveCommunity(
  slug: string,
  _prev: MemberActionState,
  _formData: FormData,
): Promise<MemberActionState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const community = await prisma.community.findUnique({ where: { slug } });
  if (!community) return { error: "Community not found" };

  if (community.ownerId === session.user.id) {
    return { error: "Owner cannot leave. Delete the community instead." };
  }

  await prisma.communityMember.delete({
    where: {
      communityId_userId: {
        communityId: community.id,
        userId: session.user.id,
      },
    },
  });

  revalidatePath("/communities");
  redirect("/communities");
}

export async function removeMember(
  slug: string,
  targetUserId: string,
  _prev: MemberActionState,
  _formData: FormData,
): Promise<MemberActionState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const community = await prisma.community.findUnique({ where: { slug } });
  if (!community) return { error: "Community not found" };

  if (community.ownerId !== session.user.id) {
    return { error: "Only the owner can remove members" };
  }

  if (targetUserId === session.user.id) {
    return { error: "Owner cannot remove themselves" };
  }

  await prisma.communityMember.delete({
    where: {
      communityId_userId: {
        communityId: community.id,
        userId: targetUserId,
      },
    },
  });

  revalidatePath(`/communities/${slug}/settings`);
  return { success: true };
}

export async function deleteCommunity(
  slug: string,
  _prev: MemberActionState,
  _formData: FormData,
): Promise<MemberActionState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const community = await prisma.community.findUnique({ where: { slug } });
  if (!community) return { error: "Community not found" };

  if (community.ownerId !== session.user.id) {
    return { error: "Only the owner can delete the community" };
  }

  await prisma.community.delete({ where: { id: community.id } });

  revalidatePath("/communities");
  redirect("/communities");
}

export async function regenerateInviteToken(
  slug: string,
  _prev: MemberActionState,
  _formData: FormData,
): Promise<MemberActionState> {
  const session = await getSession();
  if (!session) return { error: "Not authenticated" };

  const community = await prisma.community.findUnique({ where: { slug } });
  if (!community) return { error: "Community not found" };

  if (community.ownerId !== session.user.id) {
    return { error: "Only the owner can regenerate the invite link" };
  }

  const newToken = randomBytes(32).toString("hex");
  await prisma.community.update({
    where: { id: community.id },
    data: { inviteToken: newToken },
  });

  revalidatePath(`/communities/${slug}/settings`);
  return { success: true };
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
