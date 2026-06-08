import { setRequestLocale } from "next-intl/server";
import { Leaderboard } from "@/components/leaderboard";
import { redirect } from "@/i18n/navigation";
import { BET_DEADLINE, TOURNAMENT_ENDED } from "@/lib/bet-constants";
import { scopeMapper } from "@/lib/leaderboard";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { peerSummariesByOwners } from "@/modules/bet/application/peer-summaries-by-owners";
import { BettingWindow } from "@/modules/bet/domain/betting-window";
import { PrismaBetRepository } from "@/modules/bet/infrastructure/prisma-bet-repository";

export default async function LeaderboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect({ href: "/login", locale });

  // Load communities the user belongs to along with members
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
              image: true,
            },
          },
        },
      },
    },
  });

  // Get unique member IDs from all these communities
  const allUserIds = Array.from(
    new Set(communities.flatMap((c) => c.members.map((m) => m.user.id))),
  );

  const repo = new PrismaBetRepository(prisma);
  const now = new Date();
  const window = new BettingWindow(BET_DEADLINE);

  // Fetch peer summaries for all unique user IDs
  const betSummariesByOwner = await peerSummariesByOwners(
    repo,
    allUserIds,
    window,
    now,
  );

  // Map database and summary structures to leaderboard scopes
  const scopes = scopeMapper(communities, betSummariesByOwner);

  return (
    <div className="max-w-5xl">
      <Leaderboard
        scopes={scopes}
        currentUserId={session.user.id}
        tournamentEnded={TOURNAMENT_ENDED}
      />
    </div>
  );
}
