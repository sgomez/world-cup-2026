"use client";

import { Trophy, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { KnockoutBracket } from "@/components/knockout-bracket";
import { TeamBadge } from "@/components/team-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { cn } from "@/lib/utils";
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
      <header className="flex items-start gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary mt-0.5">
          <Trophy className="size-6" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h1 className="text-heading-xl font-medium uppercase tracking-tight text-foreground">
            {t("title")}
          </h1>
          <p className="text-caption-md text-muted-foreground">
            {t("description")}
          </p>
        </div>
      </header>

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
                  return (
                    <div
                      key={groupLetter}
                      className="rounded-xl border border-hairline bg-canvas p-4 shadow-sm dark:border-ash dark:bg-ink flex flex-col justify-between"
                    >
                      <div>
                        {/* Group Header */}
                        <div className="mb-3 flex items-center justify-between gap-2 border-b border-hairline pb-2 dark:border-ash">
                          <span className="font-display-campaign text-sm font-bold uppercase tracking-wider text-ink dark:text-canvas">
                            {tGroupStage("group", { letter: groupLetter })}
                          </span>
                          <span className="rounded-full bg-soft-cloud px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-mute dark:bg-charcoal dark:text-stone">
                            {tGroupStage("qualifies", {
                              qualify: cutPosition,
                              total: 4,
                            })}
                          </span>
                        </div>

                        {/* Standings Table */}
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="text-[10px] font-bold uppercase tracking-wider text-mute dark:text-stone border-b border-hairline/30 dark:border-ash/30">
                              <th className="py-1 px-1 text-left w-6">
                                {t("pos")}
                              </th>
                              <th className="py-1 px-2 text-left">
                                {t("team")}
                              </th>
                              <th className="py-1 px-1.5 text-center w-10">
                                {t("pts")}
                              </th>
                              <th className="py-1 px-1 text-center w-7">
                                {t("gf")}
                              </th>
                              <th className="py-1 px-1 text-center w-7">
                                {t("ga")}
                              </th>
                              <th className="py-1 px-1.5 text-center w-8">
                                {t("gd")}
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-hairline/10 dark:divide-ash/10 select-none">
                            {groupEntry.rows.map((row) => {
                              const team = teamLookup.get(row.teamId);
                              if (!team) return null;
                              const gdSign = row.gd > 0 ? `+${row.gd}` : row.gd;
                              return (
                                <tr
                                  key={row.teamId}
                                  className={cn(
                                    "text-sm font-semibold transition-opacity duration-200",
                                    !row.qualified && "opacity-50 grayscale",
                                  )}
                                >
                                  <td className="py-1.5 px-1 font-[family-name:var(--font-oswald)] text-xs text-mute dark:text-stone text-left">
                                    {row.position}
                                  </td>
                                  <td className="py-1.5 px-1 w-full max-w-[150px]">
                                    <div className="flex items-center gap-1.5">
                                      <TeamBadge
                                        team={team}
                                        size="compact"
                                        border={false}
                                        showGrip={false}
                                      />
                                      {liveTeamIds.has(row.teamId) && (
                                        <span className="animate-pulse rounded px-1 py-0.5 text-[8px] font-bold uppercase tracking-wider bg-sale/10 text-sale dark:bg-sale/20 shrink-0">
                                          {t("liveMarker")}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-1.5 px-1.5 text-center font-[family-name:var(--font-oswald)] text-xs text-ink dark:text-canvas">
                                    {row.pts}
                                  </td>
                                  <td className="py-1.5 px-1 text-center font-[family-name:var(--font-oswald)] text-xs text-ink dark:text-canvas">
                                    {row.gf}
                                  </td>
                                  <td className="py-1.5 px-1 text-center font-[family-name:var(--font-oswald)] text-xs text-ink dark:text-canvas">
                                    {row.ga}
                                  </td>
                                  <td
                                    className={cn(
                                      "py-1.5 px-1.5 text-center text-xs font-medium font-[family-name:var(--font-oswald)]",
                                      row.gd > 0
                                        ? "text-success dark:text-success-bright"
                                        : row.gd < 0
                                          ? "text-sale"
                                          : "text-ink dark:text-canvas",
                                    )}
                                  >
                                    {gdSign}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Best Thirds Sidebar */}
            <div className="w-full min-[1024px]:w-[320px] min-[1024px]:shrink-0">
              <div className="rounded-xl border border-hairline bg-canvas p-4 shadow-sm dark:border-ash dark:bg-ink">
                <div className="mb-3 flex items-center justify-between gap-2 border-b border-hairline pb-2 dark:border-ash">
                  <span className="font-display-campaign text-sm font-bold uppercase tracking-wider text-ink dark:text-canvas flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-primary" />
                    {t("bestThirds")}
                  </span>
                  <span className="rounded-full bg-soft-cloud px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-mute dark:bg-charcoal dark:text-stone">
                    {t("bestThirdsQualifies")}
                  </span>
                </div>

                <table className="w-full border-collapse">
                  <thead>
                    <tr className="text-[10px] font-bold uppercase tracking-wider text-mute dark:text-stone border-b border-hairline/30 dark:border-ash/30">
                      <th className="py-1 px-1 text-left w-6">{t("pos")}</th>
                      <th className="py-1 px-2 text-left">{t("team")}</th>
                      <th className="py-1 px-1.5 text-center w-10">
                        {t("pts")}
                      </th>
                      <th className="py-1 px-1 text-center w-7">{t("gf")}</th>
                      <th className="py-1 px-1 text-center w-7">{t("ga")}</th>
                      <th className="py-1 px-1.5 text-center w-8">{t("gd")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline/10 dark:divide-ash/10 select-none">
                    {standingsTable.bestThirds.map((row) => {
                      const team = teamLookup.get(row.teamId);
                      if (!team) return null;
                      const groupLetter = teamGroupMap.get(row.teamId) || "";
                      const gdSign = row.gd > 0 ? `+${row.gd}` : row.gd;

                      return (
                        <tr
                          key={row.teamId}
                          className={cn(
                            "text-sm font-semibold transition-opacity duration-200",
                            !row.qualified && "opacity-50 grayscale",
                          )}
                        >
                          <td className="py-1.5 px-1 font-[family-name:var(--font-oswald)] text-xs text-mute dark:text-stone text-left">
                            {row.position}
                          </td>
                          <td className="py-1.5 px-1 w-full max-w-[150px]">
                            <div className="flex items-center gap-1">
                              <TeamBadge
                                team={team}
                                size="compact"
                                border={false}
                                showGrip={false}
                              />
                              <span className="text-[9px] uppercase font-bold text-mute dark:text-stone shrink-0">
                                ({groupLetter})
                              </span>
                            </div>
                          </td>
                          <td className="py-1.5 px-1.5 text-center font-[family-name:var(--font-oswald)] text-xs text-ink dark:text-canvas">
                            {row.pts}
                          </td>
                          <td className="py-1.5 px-1 text-center font-[family-name:var(--font-oswald)] text-xs text-ink dark:text-canvas">
                            {row.gf}
                          </td>
                          <td className="py-1.5 px-1 text-center font-[family-name:var(--font-oswald)] text-xs text-ink dark:text-canvas">
                            {row.ga}
                          </td>
                          <td
                            className={cn(
                              "py-1.5 px-1.5 text-center text-xs font-medium font-[family-name:var(--font-oswald)]",
                              row.gd > 0
                                ? "text-success dark:text-success-bright"
                                : row.gd < 0
                                  ? "text-sale"
                                  : "text-ink dark:text-canvas",
                            )}
                          >
                            {gdSign}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
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
