import { redirect } from "next/navigation";
import { BetPrediction } from "@/components/bet-prediction";
import { BetStatusToggle } from "@/components/bet-status-toggle";
import { PageHeader } from "@/components/ui/page-header";
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

  if (!bet) redirect("/bets");

  const isOwner = bet.userId === session.user.id;
  const savedPredictions = bet.groupPredictions as PredictionState | null;
  const savedKnockoutWinners = bet.knockoutWinners as Record<
    string,
    string
  > | null;
  const isClosed = bet.status === "closed";
  const isPastDeadline = BET_DEADLINE.getTime() < Date.now();

  return (
    <div>
      <div className="mb-6">
        <PageHeader
          title={bet.label}
          action={
            isOwner && !isPastDeadline ? (
              <BetStatusToggle betId={bet.id} isClosed={isClosed} />
            ) : undefined
          }
        />
      </div>
      <BetPrediction
        betId={bet.id}
        savedPredictions={savedPredictions}
        savedKnockoutWinners={savedKnockoutWinners}
        readOnly={!isOwner || isClosed}
      />
    </div>
  );
}
