import { setRequestLocale } from "next-intl/server";
import { ArcadeStart } from "@/components/arcade-start";
import { LeaderboardTabs } from "@/components/leaderboard-tabs";
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

  // Fetch arcade ranking and resolve user names.
  const [arcadeRankingRaw, hasPlayedToday] = await Promise.all([
    container.arcade().getRanking(),
    container.arcade().hasPlayedToday(session.user.id),
  ]);

  // Resolve names for all arcade ranking users (may include users outside
  // the current user's communities — query Prisma directly for those).
  const arcadeUserIds = arcadeRankingRaw.map((e) => e.userId);
  const arcadeUsers =
    arcadeUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: arcadeUserIds } },
          select: { id: true, name: true },
        })
      : [];
  const arcadeNameCache = new Map(
    arcadeUsers.map((u) => [u.id, u.name ?? u.id]),
  );

  const arcadeEntries = arcadeRankingRaw.map((entry) => ({
    rank: entry.rank,
    userId: entry.userId,
    userName: arcadeNameCache.get(entry.userId) ?? entry.userId,
    bestScore: entry.bestScore,
    achievedAt: entry.achievedAt.toISOString(),
  }));

  return (
    <div>
      <div className="mb-6 flex justify-end">
        <ArcadeStart hasPlayedToday={hasPlayedToday} />
      </div>
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
