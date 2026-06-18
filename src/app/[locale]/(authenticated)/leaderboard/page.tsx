import { setRequestLocale } from "next-intl/server";
import { ArcadeSection } from "@/components/arcade-section";
import { LeaderboardTabs } from "@/components/leaderboard-tabs";
import { ARCADE_GAME_ENABLED } from "@/config/arcade";
import { redirect } from "@/i18n/navigation";
import { container } from "@/lib/container";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { hasLiveMatch } from "@/modules/live/domain/live-result";
import { Tournament } from "@/modules/tournament/domain/tournament";

export default async function LeaderboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect({ href: "/login", locale });

  // Load communities the user belongs to
  const communities = await prisma.community.findMany({
    where: {
      members: { some: { userId: session.user.id } },
    },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  const userCache = new Map<string, string | null>();
  for (const community of communities) {
    for (const member of community.members) {
      userCache.set(member.user.id, member.user.name);
    }
  }

  const nameResolver = container.getNameResolver(userCache);

  const [tournament, liveResults] = await Promise.all([
    container.tournament().get(),
    container.live().findAll(),
  ]);
  const activeTournament = tournament ?? Tournament.createDefault();
  const tournamentEnded = activeTournament.isCompetitionEnded(liveResults);
  const liveMatchActive = hasLiveMatch(liveResults);

  const scopesResults = await Promise.all(
    communities.map(async (community) => {
      const res = await container.leaderboard().get(
        {
          viewerId: session.user.id,
          communitySlug: community.slug,
        },
        nameResolver,
      );
      if (res.isOk()) {
        return {
          id: community.slug,
          label: community.name,
          entries: res.value.entries,
        };
      }
      return null;
    }),
  );

  const scopes = scopesResults.filter(
    (s): s is NonNullable<typeof s> => s !== null,
  );

  // Fetch arcade ranking (name resolution delegated to the use case via NameResolver).
  const [arcadeRankingRaw, hasPlayedToday] = await Promise.all([
    container.arcade().getRanking(nameResolver),
    container.arcade().hasPlayedToday(session.user.id),
  ]);

  const arcadeEntries = arcadeRankingRaw.map((entry) => ({
    rank: entry.rank,
    userId: entry.userId,
    userName: entry.userName,
    bestScore: entry.bestScore,
    achievedAt: entry.achievedAt.toISOString(),
  }));

  return (
    <div>
      <ArcadeSection
        hasPlayedToday={hasPlayedToday}
        enabled={ARCADE_GAME_ENABLED}
      />
      <LeaderboardTabs
        scopes={scopes}
        arcadeEntries={arcadeEntries}
        currentUserId={session.user.id}
        tournamentEnded={tournamentEnded}
        hasLiveMatch={liveMatchActive}
      />
    </div>
  );
}
