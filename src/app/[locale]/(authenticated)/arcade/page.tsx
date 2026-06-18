import { Gamepad2 } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArcadeRankingTable } from "@/components/arcade-ranking-table";
import { ArcadeSection } from "@/components/arcade-section";
import { PageHeader } from "@/components/ui/page-header";
import { ARCADE_GAME_ENABLED } from "@/config/arcade";
import { redirect } from "@/i18n/navigation";
import { container } from "@/lib/container";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export default async function ArcadePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect({ href: "/login", locale });

  const t = await getTranslations({ locale, namespace: "arcade" });

  // Build a NameResolver backed by Prisma so we resolve names for all
  // arcade users without copying the ad-hoc multi-query pattern from the
  // leaderboard page (issue #374).
  const nameResolver = async (userId: string): Promise<string | null> => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    return user?.name ?? null;
  };

  const [arcadeRanking, hasPlayedToday] = await Promise.all([
    container.arcade().getRanking(nameResolver),
    container.arcade().hasPlayedToday(session.user.id),
  ]);

  const arcadeEntries = arcadeRanking.map((entry) => ({
    rank: entry.rank,
    userId: entry.userId,
    userName: entry.userName,
    bestScore: entry.bestScore,
    achievedAt: entry.achievedAt.toISOString(),
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("pageTitle")}
        description={t("pageDescription")}
        icon={<Gamepad2 className="size-6" />}
        action={
          <ArcadeSection
            hasPlayedToday={hasPlayedToday}
            enabled={ARCADE_GAME_ENABLED}
          />
        }
      />
      <section className="space-y-4">
        <h2 className="text-heading-md font-medium text-foreground">
          {t("title")}
        </h2>
        <ArcadeRankingTable
          entries={arcadeEntries}
          currentUserId={session.user.id}
        />
      </section>
    </div>
  );
}
