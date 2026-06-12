import { setRequestLocale } from "next-intl/server";
import { Leaderboard } from "@/components/leaderboard";
import { redirect } from "@/i18n/navigation";
import { BET_DEADLINE } from "@/lib/bet-constants";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { BettingWindow } from "@/modules/bet/domain/betting-window";
import { PrismaBetRepository } from "@/modules/bet/infrastructure/prisma-bet-repository";
import { PrismaCommunityRepository } from "@/modules/community/infrastructure/prisma-community-repository";
import { getLeaderboard } from "@/modules/leaderboard/application/get-leaderboard";
import { PrismaLiveResultRepository } from "@/modules/live/infrastructure/prisma-live-result-repository";
import { Tournament } from "@/modules/tournament/domain/tournament";
import { PrismaTournamentRepository } from "@/modules/tournament/infrastructure/prisma-tournament-repository";

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
  });

  const communityRepo = new PrismaCommunityRepository(prisma);
  const betRepo = new PrismaBetRepository(prisma);
  const tournamentRepo = new PrismaTournamentRepository(prisma);
  const liveResultRepo = new PrismaLiveResultRepository(prisma);

  const userCache = new Map<string, string | null>();
  const getUserName = async (userId: string) => {
    if (userCache.has(userId)) return userCache.get(userId) ?? null;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    const name = user?.name ?? null;
    userCache.set(userId, name);
    return name;
  };

  const now = new Date();
  const window = new BettingWindow(BET_DEADLINE);

  const [tournament, liveResults] = await Promise.all([
    tournamentRepo.get(),
    liveResultRepo.findAll(),
  ]);
  const activeTournament = tournament ?? Tournament.createDefault();
  const tournamentEnded = activeTournament.isCompetitionEnded(liveResults);

  const scopesResults = await Promise.all(
    communities.map(async (community) => {
      const res = await getLeaderboard(
        communityRepo,
        betRepo,
        tournamentRepo,
        liveResultRepo,
        getUserName,
        {
          viewerId: session.user.id,
          communitySlug: community.slug,
          window,
          now,
        },
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

  return (
    <div className="max-w-5xl">
      <Leaderboard
        scopes={scopes}
        currentUserId={session.user.id}
        tournamentEnded={tournamentEnded}
      />
    </div>
  );
}
