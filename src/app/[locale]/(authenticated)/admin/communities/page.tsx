import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export default async function AdminCommunitiesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const session = await getSession();
  if (!session) redirect({ href: "/login", locale });

  const actor = session.user as { role?: string };
  if (actor.role !== "admin" && actor.role !== "super_admin") {
    redirect({ href: "/", locale });
  }

  const communities = await prisma.community.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      slug: true,
      name: true,
      owner: { select: { name: true } },
      _count: { select: { members: true } },
    },
  });

  return (
    <div>
      <h1 className="text-heading-xl font-medium uppercase tracking-tight text-foreground">
        {t("communitiesTitle")}
      </h1>
      <p className="mt-1 text-caption-md text-muted-foreground">
        {t("communitiesCount", { count: communities.length })}
      </p>

      <div className="mt-8 space-y-2">
        {communities.map((community) => (
          <Link
            key={community.slug}
            href={`/admin/communities/${community.slug}`}
            className="flex items-center justify-between rounded-none border border-hairline bg-canvas px-5 py-4 hover:bg-soft-cloud dark:bg-ink dark:hover:bg-charcoal transition-all"
          >
            <div>
              <p className="text-body-strong text-foreground">
                {community.name}
              </p>
              <p className="text-caption-md text-muted-foreground">
                {t("ownerLabel", { name: community.owner.name })}
              </p>
            </div>
            <span className="text-caption-sm text-muted-foreground">
              {t("membersCount", { count: community._count.members })}
            </span>
          </Link>
        ))}

        {communities.length === 0 && (
          <p className="text-caption-md text-muted-foreground">
            {t("noCommunitiesYet")}
          </p>
        )}
      </div>
    </div>
  );
}
