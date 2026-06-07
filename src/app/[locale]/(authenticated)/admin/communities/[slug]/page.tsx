import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export default async function AdminCommunityDetailPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect({ href: "/login", locale });

  const actor = session.user as { role?: string };
  if (actor.role !== "admin" && actor.role !== "super_admin") {
    redirect({ href: "/", locale });
  }

  const community = await prisma.community.findUnique({
    where: { slug },
    select: {
      name: true,
      owner: { select: { name: true } },
      members: {
        select: {
          userId: true,
          user: { select: { name: true } },
          joinedAt: true,
        },
        orderBy: { joinedAt: "asc" },
      },
    },
  });

  if (!community) notFound();

  return (
    <div className="max-w-2xl">
      <h1 className="text-heading-xl font-medium uppercase tracking-tight text-foreground">
        {community.name}
      </h1>
      <p className="mt-1 text-caption-md text-muted-foreground">
        Owner: {community.owner.name}
      </p>

      <div className="mt-8">
        <p className="text-caption-md font-medium text-foreground">
          Members ({community.members.length})
        </p>
        <ul className="mt-2 divide-y divide-hairline border border-hairline">
          {community.members.map(({ userId, user, joinedAt }) => (
            <li
              key={userId}
              className="flex items-center justify-between px-6 py-3"
            >
              <span className="text-body-md text-foreground">{user.name}</span>
              <span className="text-caption-sm text-muted-foreground">
                Joined {joinedAt.toLocaleDateString()}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6">
        <Link
          href="/admin/communities"
          className="text-caption-md text-muted-foreground underline hover:text-foreground transition-colors"
        >
          Back to Communities
        </Link>
      </div>
    </div>
  );
}
