import { setRequestLocale } from "next-intl/server";
import { BetPrediction } from "@/components/bet-prediction";
import { BetStatusToggle } from "@/components/bet-status-toggle";
import { PageHeader } from "@/components/ui/page-header";
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
