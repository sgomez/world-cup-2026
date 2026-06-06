import { setRequestLocale } from "next-intl/server";
import { Banner } from "@/components/ui/banner";
import { PageHeader } from "@/components/ui/page-header";
import { Link, redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export default async function CommunitiesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect({ href: "/login", locale });

  const communities = await prisma.community.findMany({
    where: {
      members: { some: { userId: session.user.id } },
    },
    include: { owner: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Communities"
        description="Groups where members compare predictions."
        action={
          <Link href="/communities/new" className="button-primary">
            New Community
          </Link>
        }
      />

      <div className="mt-8">
        {communities.length === 0 ? (
          <Banner>
            You haven&apos;t joined any communities yet.{" "}
            <Link href="/communities/new" className="underline">
              Create one
            </Link>{" "}
            or ask a friend for an invite link.
          </Banner>
        ) : (
          <ul className="divide-y divide-hairline border border-hairline">
            {communities.map((community) => (
              <li key={community.id}>
                <Link
                  href={`/communities/${community.slug}`}
                  className="flex items-center px-6 py-4 hover:bg-soft-cloud"
                >
                  <div>
                    <p className="text-body-strong font-medium text-foreground">
                      {community.name}
                    </p>
                    <p className="text-caption-sm text-muted-foreground">
                      Owner: {community.owner.name}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
