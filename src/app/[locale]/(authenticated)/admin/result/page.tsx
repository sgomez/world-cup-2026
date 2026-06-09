import { setRequestLocale } from "next-intl/server";
import { AdminResultEditor } from "@/components/admin-result-editor";
import { prisma } from "@/lib/prisma";
import { Tournament } from "@/modules/tournament/domain/tournament";
import { PrismaTournamentRepository } from "@/modules/tournament/infrastructure/prisma-tournament-repository";

export default async function AdminResultPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const repo = new PrismaTournamentRepository(prisma);
  const tournament = await repo.get();

  const activeTournament = tournament ?? Tournament.createDefault();
  const savedBracketView = activeTournament.bracketView();

  const savedPredictions = tournament?.result
    ? {
        groupOrders: tournament.result.groupOrders,
        thirdPlaceOrder: tournament.result.thirdPlaceOrder,
      }
    : null;
  const savedKnockoutWinners = tournament?.result?.knockoutWinners ?? null;
  const savedAdvancement = tournament?.advancement ?? [];

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
