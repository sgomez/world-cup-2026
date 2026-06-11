import { setRequestLocale } from "next-intl/server";
import { CalendarView } from "@/components/calendar-view";
import { prisma } from "@/lib/prisma";
import { PrismaLiveResultRepository } from "@/modules/live/infrastructure/prisma-live-result-repository";
import { Tournament } from "@/modules/tournament/domain/tournament";
import { PrismaTournamentRepository } from "@/modules/tournament/infrastructure/prisma-tournament-repository";

export default async function CalendarPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const tournamentRepo = new PrismaTournamentRepository(prisma);
  const liveResultRepo = new PrismaLiveResultRepository(prisma);

  const [tournament, liveResults] = await Promise.all([
    tournamentRepo.get(),
    liveResultRepo.findAll(),
  ]);

  const activeTournament = tournament ?? Tournament.createDefault();
  const bracket = activeTournament.bracketView(liveResults, {
    finishedOnly: false,
  });

  const liveResultStates = liveResults.map((lr) => lr.toState());

  return (
    <CalendarView
      liveResults={liveResultStates}
      bracketView={bracket}
      locale={locale}
    />
  );
}
