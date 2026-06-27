import { Gamepad2 } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArcadeRankingTabs } from "@/components/arcade-ranking-tabs";
import { ArcadeSection } from "@/components/arcade-section";
import { PageHeader } from "@/components/ui/page-header";
import { ARCADE_GAME_ENABLED } from "@/config/arcade";
import { redirect } from "@/i18n/navigation";
import { container } from "@/lib/container";
import { getSession } from "@/lib/session";
import type { ArcadeRankingEntry } from "@/modules/arcade/application/get-arcade-ranking";

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

  // Use the container's memoized NameResolver seam (same as the leaderboard
  // page) so we avoid N+1 queries: each userId is looked up at most once per
  // request and the cache is shared across all getRanking calls.
  const nameResolver = container.getNameResolver();

  const [dailyRanking, weeklyRanking, allTimeRanking, hasPlayedToday] =
    await Promise.all([
      container.arcade().getRanking(nameResolver, "daily"),
      container.arcade().getRanking(nameResolver, "weekly"),
      container.arcade().getRanking(nameResolver, "all_time"),
      container.arcade().hasPlayedToday(session.user.id),
    ]);

  function toEntries(ranking: ArcadeRankingEntry[]) {
    return ranking.map((entry) => ({
      rank: entry.rank,
      userId: entry.userId,
      userName: entry.userName,
      bestScore: entry.bestScore,
      achievedAt: entry.achievedAt.toISOString(),
    }));
  }

  const rankings = {
    daily: toEntries(dailyRanking),
    weekly: toEntries(weeklyRanking),
    all_time: toEntries(allTimeRanking),
  };

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
        <ArcadeRankingTabs
          rankings={rankings}
          currentUserId={session.user.id}
        />
      </section>
    </div>
  );
}
