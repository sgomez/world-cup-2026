import { redirect } from "next/navigation";
import { BetPrediction } from "@/components/bet-prediction";
import { BetStatusToggle } from "@/components/bet-status-toggle";
import { BET_DEADLINE } from "@/lib/bet-constants";
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
  const savedKnockoutWinners = bet.knockoutWinners as Record<
    string,
    string
  > | null;
  const isClosed = bet.status === "closed";
  const isPastDeadline = BET_DEADLINE.getTime() < Date.now();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {bet.label}
        </h1>
        {!isPastDeadline && (
          <BetStatusToggle betId={bet.id} isClosed={isClosed} />
        )}
      </div>
      <BetPrediction
        betId={bet.id}
        savedPredictions={savedPredictions}
        savedKnockoutWinners={savedKnockoutWinners}
        readOnly={isClosed}
      />
    </div>
  );
}
