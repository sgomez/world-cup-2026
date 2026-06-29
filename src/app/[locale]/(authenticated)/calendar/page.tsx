import { setRequestLocale } from "next-intl/server";
import { CalendarView } from "@/components/calendar-view";
import { container } from "@/lib/container";
import { getSession } from "@/lib/session";
import { Tournament } from "@/modules/tournament/domain/tournament";

export default async function CalendarPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [tournament, liveResults, session] = await Promise.all([
    container.tournament().get(),
    container.live().findAll(),
    getSession(),
  ]);

  const activeTournament = tournament ?? Tournament.createDefault();
  const bracket = activeTournament.bracketView(liveResults, {
    finishedOnly: false,
  });

  const liveResultStates = liveResults.map((lr) => lr.toState());
  const isAdmin =
    session?.user.role === "admin" || session?.user.role === "super_admin";

  return (
    <CalendarView
      liveResults={liveResultStates}
      bracketView={bracket}
      locale={locale}
      isAdmin={isAdmin}
    />
  );
}
