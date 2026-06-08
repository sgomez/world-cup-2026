import { setRequestLocale } from "next-intl/server";
import { AdminResultEditor } from "@/components/admin-result-editor";
import { prisma } from "@/lib/prisma";
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

  const savedPredictions = tournament?.result
    ? {
        groupOrders: tournament.result.groupOrders,
        thirdPlaceOrder: tournament.result.thirdPlaceOrder,
      }
    : null;
  const savedKnockoutWinners = tournament?.result?.knockoutWinners ?? null;

  return (
    <div className="container mx-auto py-6">
      <AdminResultEditor
        savedPredictions={savedPredictions}
        savedKnockoutWinners={savedKnockoutWinners}
      />
    </div>
  );
}
