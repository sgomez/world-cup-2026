import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { BetPrediction } from "@/components/bet-prediction";
import { redirect } from "@/i18n/navigation";
import { container } from "@/lib/container";
import { getSession } from "@/lib/session";
import { hasLiveMatch } from "@/modules/live/domain/live-result";
import { getActualScoreableContent } from "@/modules/tournament/application/get-actual-scoreable-content";

export default async function BetPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect({ href: "/login", locale });

  const bet = await container.bets().findById(id);

  if (!bet?.isOwnedBy(session.user.id)) {
    notFound();
  }

  const isOwner = true; // since it is gated to the owner only
  const savedPredictions = bet.groupPredictions;
  const savedKnockoutWinners = bet.knockoutWinners;
  const isClosed = bet.status === "closed";
  const isPastDeadline = container.bets().isPastDeadline();

  const [tournament, liveResults] = await Promise.all([
    container.tournament().get(),
    container.live().findAll(),
  ]);
  const actualResults = getActualScoreableContent(tournament, liveResults);
  const liveMatchActive = hasLiveMatch(liveResults);

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
        actualResults={actualResults}
        hasLiveMatch={liveMatchActive}
      />
    </div>
  );
}
