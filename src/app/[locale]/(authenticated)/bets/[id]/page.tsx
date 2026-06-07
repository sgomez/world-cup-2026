import { setRequestLocale } from "next-intl/server";
import { BetPrediction } from "@/components/bet-prediction";
import { redirect } from "@/i18n/navigation";
import { BET_DEADLINE } from "@/lib/bet-constants";
import type { PredictionState } from "@/lib/prediction-state";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export default async function BetPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect({ href: "/login", locale });

  const bet = await prisma.bet.findUnique({ where: { id } });

  if (!bet) redirect({ href: "/bets", locale });

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
      <BetPrediction
        betId={bet.id}
        betLabel={bet.label}
        isOwner={isOwner}
        isPastDeadline={isPastDeadline}
        isClosed={isClosed}
        savedPredictions={savedPredictions}
        savedKnockoutWinners={savedKnockoutWinners}
      />
    </div>
  );
}
