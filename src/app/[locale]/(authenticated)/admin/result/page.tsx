import { setRequestLocale } from "next-intl/server";
import { AdminResultEditor } from "@/components/admin-result-editor";
import { getAllMatches } from "@/lib/matches";
import { prisma } from "@/lib/prisma";
import type { LiveResultState } from "@/modules/live/domain/live-result";
import { PrismaLiveResultRepository } from "@/modules/live/infrastructure/prisma-live-result-repository";
import { deriveTieInfo } from "@/modules/tournament/domain/derive-result";
import { Tournament } from "@/modules/tournament/domain/tournament";
import { PrismaTournamentRepository } from "@/modules/tournament/infrastructure/prisma-tournament-repository";

export default async function AdminResultPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const tournamentRepo = new PrismaTournamentRepository(prisma);
  const liveResultRepo = new PrismaLiveResultRepository(prisma);

  const [tournament, liveResults] = await Promise.all([
    tournamentRepo.get(),
    liveResultRepo.findAll(),
  ]);

  const activeTournament = tournament ?? Tournament.createDefault();
  const tieInfo = deriveTieInfo(
    liveResults,
    activeTournament.manualTieBreaks,
    activeTournament.thirdPlaceManualOrder,
  );

  const allMatches = getAllMatches();
  const liveResultStates: LiveResultState[] = liveResults.map((lr) =>
    lr.toState(),
  );

  const factorsToOrderedList = (
    factors: Record<string, number> | null | undefined,
  ): string[] => {
    if (!factors) return [];
    return Object.entries(factors)
      .sort(([, a], [, b]) => b - a)
      .map(([teamId]) => teamId);
  };

  const mappedManualTieBreaks: Record<string, string[]> = {};
  for (const [group, factors] of Object.entries(
    activeTournament.manualTieBreaks,
  )) {
    mappedManualTieBreaks[group] = factorsToOrderedList(factors);
  }
  const mappedThirdPlaceManualOrder = activeTournament.thirdPlaceManualOrder
    ? factorsToOrderedList(activeTournament.thirdPlaceManualOrder)
    : null;

  return (
    <div className="container mx-auto py-6">
      <AdminResultEditor
        matches={allMatches}
        liveResults={liveResultStates}
        groupTieInfo={tieInfo.groups}
        thirdsTieClusters={tieInfo.thirdsTieClusters}
        manualTieBreaks={mappedManualTieBreaks}
        thirdPlaceManualOrder={mappedThirdPlaceManualOrder}
        locale={locale}
      />
    </div>
  );
}
