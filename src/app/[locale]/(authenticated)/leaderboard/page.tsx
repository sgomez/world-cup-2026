import { setRequestLocale } from "next-intl/server";
import { Leaderboard } from "@/components/leaderboard";
import { redirect } from "@/i18n/navigation";
import { BET_DEADLINE } from "@/lib/bet-constants";
import { scopeMapper } from "@/lib/leaderboard";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { peerSummariesByOwners } from "@/modules/bet/application/peer-summaries-by-owners";
import { Bet } from "@/modules/bet/domain/bet";
import { BettingWindow } from "@/modules/bet/domain/betting-window";
import { PrismaBetRepository } from "@/modules/bet/infrastructure/prisma-bet-repository";
import { getActualScoreableContent } from "@/modules/tournament/application/get-actual-scoreable-content";
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
  const isPastDeadline = window.isClosed(now);

  const betsByOwner = new Map<string, Bet[]>();
  if (isPastDeadline) {
    const bets = await repo.listByOwners(allUserIds);
    for (const bet of bets) {
      const visibility = bet.peerVisibility(window, now);
      if (visibility === "hidden") continue;
      const list = betsByOwner.get(bet.userId) ?? [];
      list.push(bet);
      betsByOwner.set(bet.userId, list);
    }
  } else {
    // Before deadline, only fetch summaries (keeps predictions secure in DB)
    const betSummariesByOwner = await peerSummariesByOwners(
      repo,
      allUserIds,
      window,
      now,
    );
    for (const [userId, summaries] of betSummariesByOwner.entries()) {
      betsByOwner.set(
        userId,
        summaries.map((s) =>
          Bet.fromState({
            id: s.id,
            userId,
            label: s.label,
            status: s.status,
            groupPredictions: null,
            knockoutWinners: {},
            createdAt: s.createdAt,
            updatedAt: s.updatedAt,
          }),
        ),
      );
    }
  }

  const tournamentRepo = new PrismaTournamentRepository(prisma);
  const tournament = await tournamentRepo.get();
  const activeTournament = tournament ?? Tournament.createDefault();
  const actualResults = await getActualScoreableContent(tournamentRepo);
  const tournamentEnded = activeTournament.isCompetitionEnded();

  // Map database and summary structures to leaderboard scopes
  const scopes = scopeMapper(
    communities,
    betsByOwner,
    actualResults,
    isPastDeadline,
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
