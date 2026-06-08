import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { PrismaBetRepository } from "@/modules/bet/infrastructure/prisma-bet-repository";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export default async function AdminCommunityDetailPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const session = await getSession();
  if (!session) redirect({ href: "/login", locale });

  const actor = session.user as { role?: string };
  if (actor.role !== "admin" && actor.role !== "super_admin") {
    redirect({ href: "/", locale });
  }

  const communityRaw = await prisma.community.findUnique({
    where: { slug },
    select: {
      name: true,
      owner: { select: { name: true } },
      members: {
        select: {
          userId: true,
          user: {
            select: {
              name: true,
            },
          },
          joinedAt: true,
        },
        orderBy: { joinedAt: "asc" },
      },
    },
  });

  if (!communityRaw) notFound();

  const userIds = communityRaw.members.map((m) => m.userId);
  const repo = new PrismaBetRepository(prisma);
  const allBets = await repo.listByOwners(userIds);

  const betsByUserId = new Map<string, typeof allBets>();
  for (const bet of allBets) {
    const list = betsByUserId.get(bet.userId) ?? [];
    list.push(bet);
    betsByUserId.set(bet.userId, list);
  }

  const community = {
    ...communityRaw,
    members: communityRaw.members.map((m) => {
      const userBets = betsByUserId.get(m.userId) ?? [];
      const bets = userBets.map((b) => {
        const state = b.toState();
        return {
          id: state.id,
          label: state.label,
          status: state.status,
          createdAt: state.createdAt ?? new Date(),
          updatedAt: state.updatedAt ?? new Date(),
          signature: b.signature,
        };
      });
      return {
        ...m,
        user: {
          ...m.user,
          bets,
        },
      };
    }),
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-heading-xl font-medium uppercase tracking-tight text-foreground">
        {community.name}
      </h1>
      <p className="mt-1 text-caption-md text-muted-foreground">
        {t("ownerLabel", { name: community.owner.name })}
      </p>

      <div className="mt-8">
        <p className="text-caption-md font-medium text-foreground">
          {t("membersLabel", { count: community.members.length })}
        </p>
        <div className="mt-2 space-y-6">
          {community.members.map(({ userId, user, joinedAt }) => (
            <div key={userId}>
              <div className="flex items-center justify-between border border-hairline px-6 py-3">
                <span className="text-body-md text-foreground">
                  {user.name}
                </span>
                <span className="text-caption-sm text-muted-foreground">
                  {t("joinedLabel", { date: joinedAt.toLocaleDateString() })}
                </span>
              </div>
              {user.bets.length === 0 ? (
                <p className="mt-1 px-6 text-caption-sm text-muted-foreground">
                  {t("noBetsYet")}
                </p>
              ) : (
                <div className="space-y-1">
                  {user.bets.map((bet) => {
                    const sig = bet.signature;
                    return (
                      <div
                        key={bet.id}
                        className="rounded-none border border-hairline bg-canvas px-5 py-3 dark:bg-ink"
                      >
                        <p className="text-body-md text-foreground">
                          {bet.label}
                        </p>
                        <div className="mt-1 flex gap-4 text-caption-sm text-muted-foreground">
                          <span>
                            {t("createdLabel", {
                              date: bet.createdAt.toLocaleDateString(),
                            })}
                          </span>
                          {sig && (
                            <span className="font-mono" title={sig}>
                              {t("signature")}: {sig.slice(0, 8)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <Link
          href="/admin/communities"
          className="text-caption-md text-muted-foreground underline hover:text-foreground transition-colors"
        >
          {t("backToCommunities")}
        </Link>
      </div>
    </div>
  );
}
