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

  return (
    <div className="container mx-auto py-6">
      <AdminResultEditor
        matches={allMatches}
        liveResults={liveResultStates}
        groupTieInfo={tieInfo.groups}
        thirdsTieClusters={tieInfo.thirdsTieClusters}
        manualTieBreaks={activeTournament.manualTieBreaks}
        thirdPlaceManualOrder={activeTournament.thirdPlaceManualOrder}
        locale={locale}
      />
    </div>
  );
}
