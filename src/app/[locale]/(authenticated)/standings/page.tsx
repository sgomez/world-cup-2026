import { setRequestLocale } from "next-intl/server";
import { StandingsView } from "@/components/standings-view";
import { prisma } from "@/lib/prisma";
import { PrismaTournamentRepository } from "@/modules/tournament/infrastructure/prisma-tournament-repository";

export default async function StandingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const repo = new PrismaTournamentRepository(prisma);
  const tournament = await repo.get();

  const defaultTab = "groups";

  const savedPredictions = tournament?.result
    ? {
        groupOrders: tournament.result.groupOrders,
        thirdPlaceOrder: tournament.result.thirdPlaceOrder,
      }
    : null;
  const savedKnockoutWinners = tournament?.result?.knockoutWinners ?? null;
  const savedAdvancement = (tournament?.advancement as string[]) ?? [];

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
