import { setRequestLocale } from "next-intl/server";
import { CalendarView } from "@/components/calendar-view";
import { container } from "@/lib/container";
import { Tournament } from "@/modules/tournament/domain/tournament";

export default async function CalendarPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [tournament, liveResults] = await Promise.all([
    container.tournament().get(),
    container.live().findAll(),
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
