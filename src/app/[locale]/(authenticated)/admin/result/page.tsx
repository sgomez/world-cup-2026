import { setRequestLocale } from "next-intl/server";
import { AdminResultEditor } from "@/components/admin-result-editor";
import { container } from "@/lib/container";
import { getAllMatches } from "@/lib/matches";
import type { LiveResultState } from "@/modules/live/domain/live-result";
import { deriveTieInfo } from "@/modules/tournament/domain/derive-result";
import { Tournament } from "@/modules/tournament/domain/tournament";

export default async function AdminResultPage({
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
  const tieInfo = deriveTieInfo(
    liveResults,
    activeTournament.manualTieBreaks,
    activeTournament.thirdPlaceManualOrder,
  );

  const allMatches = getAllMatches();
  const liveResultStates: LiveResultState[] = liveResults.map((lr) =>
    lr.toState(),
  );

  const bracket = activeTournament.bracketView(liveResults, {
    finishedOnly: false,
  });

  // Convert KnockoutMatch values to serializable states
  const serializableBracket: Record<
    string,
    {
      id: string;
      round: string;
      team1Id: string | null;
      team2Id: string | null;
      winnerId: string | null;
      loserId: string | null;
    }
  > = {};
  for (const [key, match] of Object.entries(bracket)) {
    serializableBracket[key] = {
      id: match.id,
      round: match.round,
      team1Id: match.team1Id,
      team2Id: match.team2Id,
      winnerId: match.winnerId,
      loserId: match.loserId,
    };
  }

  return (
    <div className="container mx-auto py-6">
      <AdminResultEditor
        matches={allMatches}
        liveResults={liveResultStates}
        groupTieInfo={tieInfo.groups}
        thirdsTieClusters={tieInfo.thirdsTieClusters}
        manualTieBreaks={activeTournament.manualTieBreaks}
        thirdPlaceManualOrder={activeTournament.thirdPlaceManualOrder}
        bracketView={serializableBracket}
        locale={locale}
      />
    </div>
  );
}
