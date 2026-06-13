import { setRequestLocale } from "next-intl/server";
import { StandingsView } from "@/components/standings-view";
import { container } from "@/lib/container";
import { getAllMatches } from "@/modules/schedule";
import { getTeamByName } from "@/modules/teams";
import { deriveResult } from "@/modules/tournament/domain/derive-result";
import { Tournament } from "@/modules/tournament/domain/tournament";

export default async function StandingsPage({
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
  const derived = deriveResult(
    liveResults,
    activeTournament.manualTieBreaks,
    activeTournament.thirdPlaceManualOrder,
    { finishedOnly: false }, // include live matches for provisional standings
  );

  // defaultTab = knockout once all 32 R32 slots are settled
  const allR32Settled = derived.advancement.length >= 32;
  const defaultTab = allR32Settled ? "knockout" : "groups";

  // Compute which team IDs are currently in a live group-stage match (num 1–72)
  const liveNums = new Set(
    liveResults
      .filter((lr) => lr.status === "live" && lr.num >= 1 && lr.num <= 72)
      .map((lr) => lr.num),
  );
  const allGroupMatches = getAllMatches().filter(
    (m) => m.num >= 1 && m.num <= 72,
  );
  const liveTeamIds = new Set<string>();
  for (const match of allGroupMatches) {
    if (!liveNums.has(match.num)) continue;
    const t1 = getTeamByName(match.team1, "en");
    const t2 = getTeamByName(match.team2, "en");
    if (t1) liveTeamIds.add(t1.id);
    if (t2) liveTeamIds.add(t2.id);
  }

  const savedPredictions =
    Object.keys(derived.groupOrders).length > 0
      ? {
          groupOrders: derived.groupOrders,
          thirdPlaceOrder: derived.thirdPlaceOrder,
        }
      : null;
  const savedKnockoutWinners =
    Object.keys(derived.knockoutWinners).length > 0
      ? derived.knockoutWinners
      : null;
  const savedAdvancement = derived.advancement;

  const liveResultsData = liveResults.map((lr) => ({
    num: lr.num,
    status: lr.status,
    goals1: lr.goals1,
    goals2: lr.goals2,
    penalties1: lr.penalties1,
    penalties2: lr.penalties2,
  }));

  return (
    <div className="container mx-auto py-6">
      <StandingsView
        defaultTab={defaultTab}
        locale={locale}
        standingsTable={derived.standingsTable}
        liveTeamIds={liveTeamIds}
        liveResults={liveResultsData}
        savedPredictions={savedPredictions}
        savedKnockoutWinners={savedKnockoutWinners}
        savedAdvancement={savedAdvancement}
      />
    </div>
  );
}
