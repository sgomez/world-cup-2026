import { setRequestLocale } from "next-intl/server";
import { StandingsView } from "@/components/standings-view";
import { prisma } from "@/lib/prisma";
import { PrismaLiveResultRepository } from "@/modules/live/infrastructure/prisma-live-result-repository";
import { deriveResult } from "@/modules/tournament/domain/derive-result";
import { Tournament } from "@/modules/tournament/domain/tournament";
import { PrismaTournamentRepository } from "@/modules/tournament/infrastructure/prisma-tournament-repository";

export default async function StandingsPage({
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
  const derived = deriveResult(
    liveResults,
    activeTournament.manualTieBreaks,
    activeTournament.thirdPlaceManualOrder,
    { finishedOnly: false }, // include live matches for provisional standings
  );

  // defaultTab = knockout once all 32 R32 slots are settled
  const allR32Settled = derived.advancement.length >= 32;
  const defaultTab = allR32Settled ? "knockout" : "groups";

  const savedPredictions =
    Object.keys(derived.groupOrders).length > 0
      ? {
          groupOrders: derived.groupOrders,
          thirdPlaceOrder: derived.thirdPlaceOrder,
        }
      : null;
  const savedKnockoutWinners =
    Object.keys(derived.knockoutWinners).length > 0
      ? derived.knockoutWinners
      : null;
  const savedAdvancement = derived.advancement;

  return (
    <div className="container mx-auto py-6">
      <StandingsView
        defaultTab={defaultTab}
        locale={locale}
        savedPredictions={savedPredictions}
        savedKnockoutWinners={savedKnockoutWinners}
        savedAdvancement={savedAdvancement}
      />
    </div>
  );
}
