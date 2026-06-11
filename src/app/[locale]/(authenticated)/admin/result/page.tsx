import { setRequestLocale } from "next-intl/server";
import { AdminResultEditor } from "@/components/admin-result-editor";
import { prisma } from "@/lib/prisma";
import { PrismaLiveResultRepository } from "@/modules/live/infrastructure/prisma-live-result-repository";
import { deriveResult } from "@/modules/tournament/domain/derive-result";
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
  const derived = deriveResult(
    liveResults,
    activeTournament.manualTieBreaks,
    activeTournament.thirdPlaceManualOrder,
  );

  const savedBracketView = activeTournament.bracketView(liveResults);
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
      <AdminResultEditor
        savedPredictions={savedPredictions}
        savedKnockoutWinners={savedKnockoutWinners}
        savedAdvancement={savedAdvancement}
        savedBracketView={savedBracketView}
      />
    </div>
  );
}
