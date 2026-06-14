"use client";

import { Trophy, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { GroupStandingsCard } from "@/components/group-standings-card";
import { KnockoutBracket } from "@/components/knockout-bracket";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { getGroups, type Team } from "@/modules/teams";
import { computeTournamentBracket } from "@/modules/tournament/domain/derive-result";
import type { StandingsTable } from "@/modules/tournament/domain/standings";

// Stable empty set for default liveTeamIds prop — avoids spurious memoization
// cache misses with React Compiler when the prop is omitted.
const EMPTY_LIVE_TEAM_IDS = new Set<string>();

export function StandingsView({
  defaultTab,
  locale,
  standingsTable,
  liveTeamIds = EMPTY_LIVE_TEAM_IDS,
  liveResults = [],
  savedPredictions = null,
  savedKnockoutWinners = null,
  savedAdvancement = [],
}: {
  defaultTab: "groups" | "knockout";
  locale: string;
  standingsTable: StandingsTable;
  liveTeamIds?: Set<string>;
  liveResults?: {
    num: number;
    status: string;
    goals1: number;
    goals2: number;
    penalties1?: number;
    penalties2?: number;
  }[];
  savedPredictions?: {
    groupOrders: Record<string, string[]>;
    thirdPlaceOrder: string[];
  } | null;
  savedKnockoutWinners?: Record<string, string> | null;
  savedAdvancement?: string[];
}) {
  useLiveRefresh();
  const t = useTranslations("tournament");
  const tGroupStage = useTranslations("groupStage");

  const [activeTab, setActiveTab] = useState<string>(defaultTab);

  const { teamLookup, teamGroupMap } = useMemo(() => {
    const baseGroups = getGroups(locale);
    const lookup = new Map<string, Team>();
    const groupMap = new Map<string, string>();
    for (const g of baseGroups) {
      for (const t of g.teams) {
        lookup.set(t.id, t);
        groupMap.set(t.id, g.group);
      }
    }
    return { teamLookup: lookup, teamGroupMap: groupMap };
  }, [locale]);

  const groups = useMemo(() => {
    const baseGroups = getGroups(locale);
    if (!savedPredictions?.groupOrders) return baseGroups;

    return baseGroups.map((g) => {
      const orderedIds = savedPredictions.groupOrders[g.group];
      if (!orderedIds) return g;

      const teamMap = new Map(g.teams.map((t) => [t.id, t]));
      const orderedTeams = orderedIds
        .map((id) => teamMap.get(id))
        .filter((t): t is Team => !!t);

      const missingTeams = g.teams.filter((t) => !orderedIds.includes(t.id));

      return {
        group: g.group,
        teams: [...orderedTeams, ...missingTeams],
      };
    });
  }, [locale, savedPredictions?.groupOrders]);

  // Build predictions & propagate teams in bracket core
  const bracketMatches = useMemo(() => {
    const groupOrders =
      savedPredictions?.groupOrders ??
      Object.fromEntries(
        groups.map((g) => [g.group, g.teams.map((t) => t.id)]),
      );
    const thirdPlaceOrder =
      savedPredictions?.thirdPlaceOrder ??
      groups.map((g) => `3rd-${g.group.toLowerCase()}`);
    const knockoutWinners = savedKnockoutWinners ?? {};

    return computeTournamentBracket({
      groupOrders,
      thirdPlaceOrder,
      knockoutWinners,
      advancement: savedAdvancement,
      standingsTable,
    });
  }, [
    groups,
    savedPredictions,
    savedKnockoutWinners,
    savedAdvancement,
    standingsTable,
  ]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title={t("title")}
        description={t("description")}
        icon={<Trophy className="size-6" aria-hidden="true" />}
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList
          variant="line"
          className="mb-6 w-full justify-start gap-6 pb-0 border-b border-hairline dark:border-ash"
        >
          <TabsTrigger
            value="groups"
            className="px-1 py-2 text-caption-md text-mute dark:text-stone data-active:text-ink dark:data-active:text-canvas"
          >
            {t("groupStage")}
          </TabsTrigger>
          <TabsTrigger
            value="knockout"
            className="px-1 py-2 text-caption-md text-mute dark:text-stone data-active:text-ink dark:data-active:text-canvas"
          >
            {t("knockoutStage")}
          </TabsTrigger>
        </TabsList>

        {/* Group Stage Tab */}
        <TabsContent value="groups">
          {/* Live legend — only shown when at least one team is currently live */}
          {liveTeamIds.size > 0 && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-hairline bg-canvas px-3 py-2 shadow-sm dark:border-ash dark:bg-ink">
              <span className="animate-pulse rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-sale/10 text-sale dark:bg-sale/20">
                {t("liveMarker")}
              </span>
              <span className="text-[11px] text-mute dark:text-stone">
                {t("liveMarkerLegend")}
              </span>
            </div>
          )}
          <div className="flex flex-col gap-6 min-[1024px]:flex-row">
            {/* Groups Grid */}
            <div className="min-w-0 flex-1">
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                {Object.keys(standingsTable.groups).map((groupLetter) => {
                  const groupEntry = standingsTable.groups[groupLetter];
                  const cutPosition = [
                    "A",
                    "B",
                    "C",
                    "D",
                    "E",
                    "F",
                    "G",
                    "H",
                  ].includes(groupLetter)
                    ? 3
                    : 2;
                  const groupRows = groupEntry.rows.flatMap((row) => {
                    const team = teamLookup.get(row.teamId);
                    if (!team) return [];
                    return [{ ...row, team }];
                  });
                  return (
                    <GroupStandingsCard
                      key={groupLetter}
                      title={tGroupStage("group", { letter: groupLetter })}
                      qualifyLabel={tGroupStage("qualifies", {
                        qualify: cutPosition,
                        total: 4,
                      })}
                      rows={groupRows}
                      liveTeamIds={liveTeamIds}
                    />
                  );
                })}
              </div>
            </div>

            {/* Best Thirds Sidebar */}
            <div className="w-full min-[1024px]:w-[320px] min-[1024px]:shrink-0">
              <GroupStandingsCard
                title={t("bestThirds")}
                titleIcon={<Users className="h-4 w-4 text-primary" />}
                qualifyLabel={t("bestThirdsQualifies")}
                rows={standingsTable.bestThirds.flatMap((row) => {
                  const team = teamLookup.get(row.teamId);
                  if (!team) return [];
                  return [{ ...row, team }];
                })}
                liveTeamIds={liveTeamIds}
                rowSuffix={(row) => {
                  const groupLetter = teamGroupMap.get(row.teamId) || "";
                  return (
                    <span className="text-[9px] uppercase font-bold text-mute dark:text-stone shrink-0">
                      ({groupLetter})
                    </span>
                  );
                }}
              />
            </div>
          </div>
        </TabsContent>

        {/* Knockout Stage Tab */}
        <TabsContent value="knockout" className="space-y-6">
          <KnockoutBracket
            mode="scored"
            bracketMatches={bracketMatches}
            liveResults={liveResults}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
