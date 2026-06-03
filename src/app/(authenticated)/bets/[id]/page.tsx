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

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-white">{bet.label}</h1>
      <div className="mt-6">
        <BetPrediction betId={bet.id} savedPredictions={savedPredictions} />
      </div>
    </div>
  );
}
