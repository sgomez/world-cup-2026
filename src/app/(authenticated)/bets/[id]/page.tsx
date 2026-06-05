import { redirect } from "next/navigation";
import { BetPrediction } from "@/components/bet-prediction";
import type { PredictionState } from "@/lib/prediction-state";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export default async function BetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const bet = await prisma.bet.findUnique({ where: { id } });

  if (!bet || bet.userId !== session.user.id) redirect("/bets");

  const savedPredictions = bet.groupPredictions as PredictionState | null;
  const savedKnockoutWinners = bet.knockoutWinners as Record<string, string> | null;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-900 dark:text-white">
        {bet.label}
      </h1>
      <BetPrediction
        betId={bet.id}
        savedPredictions={savedPredictions}
        savedKnockoutWinners={savedKnockoutWinners}
      />
    </div>
  );
}
