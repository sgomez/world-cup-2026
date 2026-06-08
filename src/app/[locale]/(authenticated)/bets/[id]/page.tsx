import { setRequestLocale } from "next-intl/server";
import { BetPrediction } from "@/components/bet-prediction";
import { redirect } from "@/i18n/navigation";
import { BET_DEADLINE } from "@/lib/bet-constants";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { BettingWindow } from "@/modules/bet/domain/betting-window";
import { PrismaBetRepository } from "@/modules/bet/infrastructure/prisma-bet-repository";

export default async function BetPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect({ href: "/login", locale });

  const repo = new PrismaBetRepository(prisma);
  const bet = await repo.findById(id);

  if (!bet) redirect({ href: "/bets", locale });

  const isOwner = bet.isOwnedBy(session.user.id);
  const savedPredictions = bet.groupPredictions;
  const savedKnockoutWinners = bet.knockoutWinners;
  const isClosed = bet.status === "closed";
  const window = new BettingWindow(BET_DEADLINE);
  const isPastDeadline = window.isClosed(new Date());

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
