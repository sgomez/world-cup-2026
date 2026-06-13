"use client";

import { Trophy, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { KnockoutBracket } from "@/components/knockout-bracket";
import { TeamBadge } from "@/components/team-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { getAllMatches } from "@/modules/schedule";
import { getGroups, getTeamByName, type Team } from "@/modules/teams";
import { computeTournamentBracket } from "@/modules/tournament/domain/derive-result";

const REFRESH_INTERVAL =
  parseInt(process.env.NEXT_PUBLIC_REFRESH_INTERVAL ?? "", 10) || 30_000;

// Stable empty set for default liveTeamIds prop — avoids spurious memoization
// cache misses with React Compiler when the prop is omitted.
const EMPTY_LIVE_TEAM_IDS = new Set<string>();

// Mock standings calculation mapping
type MockStats = {
  position: number;
  pts: number;
  gf: number;
  ga: number;
  gd: number;
  qualified: boolean;
};

export function StandingsView({
  defaultTab,
  locale,
  liveTeamIds = EMPTY_LIVE_TEAM_IDS,
  liveResults = [],
  savedPredictions = null,
  savedKnockoutWinners = null,
  savedAdvancement = [],
}: {
  defaultTab: "groups" | "knockout";
  locale: string;
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
  const router = useRouter();
  const t = useTranslations("tournament");
  const tGroupStage = useTranslations("groupStage");

  const [activeTab, setActiveTab] = useState<string>(defaultTab);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Auto-refresh every 30s when the tab is visible
  useEffect(() => {
    if (!isMounted) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (intervalId) return;
      intervalId = setInterval(() => {
        if (document.visibilityState === "visible") {
          router.refresh();
        }
      }, REFRESH_INTERVAL);
    };

    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        startPolling();
      } else {
        stopPolling();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    startPolling();

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isMounted, router]);

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

  // Calculate raw stats for all teams in the groups
  const rawTeamStats = useMemo(() => {
    const stats = new Map<
      string,
      {
        pts: number;
        gf: number;
        ga: number;
        gd: number;
        isAnyMatchPlayed: boolean;
      }
    >();
    const liveMap = new Map((liveResults || []).map((lr) => [lr.num, lr]));

    for (const group of groups) {
      const groupName = `Group ${group.group}`;
      const allGroupMatches = getAllMatches().filter(
        (m) => m.group === groupName,
      );
      const isAnyMatchPlayed = allGroupMatches.some((m) => {
        const lr = liveMap.get(m.num);
        return lr && lr.status !== "upcoming";
      });

      for (const team of group.teams) {
        let pts = 0;
        let gf = 0;
        let ga = 0;

        for (const match of allGroupMatches) {
          const lr = liveMap.get(match.num);
          if (!lr || lr.status === "upcoming") continue;

          const t1 = getTeamByName(match.team1, "en");
          const t2 = getTeamByName(match.team2, "en");
          if (!t1 || !t2) continue;

          if (t1.id === team.id) {
            gf += lr.goals1;
            ga += lr.goals2;
            if (lr.goals1 > lr.goals2) pts += 3;
            else if (lr.goals1 === lr.goals2) pts += 1;
          } else if (t2.id === team.id) {
            gf += lr.goals2;
            ga += lr.goals1;
            if (lr.goals2 > lr.goals1) pts += 3;
            else if (lr.goals2 === lr.goals1) pts += 1;
          }
        }

        stats.set(team.id, { pts, gf, ga, gd: gf - ga, isAnyMatchPlayed });
      }
    }
    return stats;
  }, [groups, liveResults]);

  // Compute the Best Third-place Teams standings table
  const bestThirdsStandings = useMemo(() => {
    const thirds = groups.map((g) => {
      const team = g.teams[2]; // 3rd place team in ordered array
      const stats = rawTeamStats.get(team.id) || {
        pts: 0,
        gf: 0,
        ga: 0,
        gd: 0,
        isAnyMatchPlayed: false,
      };
      return {
        team,
        groupLetter: g.group,
        position: 3,
        pts: stats.pts,
        gf: stats.gf,
        ga: stats.ga,
        gd: stats.gd,
        qualified: true,
      };
    });

    if (
      savedPredictions?.thirdPlaceOrder &&
      savedPredictions.thirdPlaceOrder.length > 0
    ) {
      const orderMap = new Map(
        savedPredictions.thirdPlaceOrder.map((id, index) => [id, index]),
      );
      return thirds.sort((a, b) => {
        const aId = `3rd-${a.groupLetter.toLowerCase()}`;
        const bId = `3rd-${b.groupLetter.toLowerCase()}`;
        const aIndex = orderMap.get(aId) ?? 999;
        const bIndex = orderMap.get(bId) ?? 999;
        return aIndex - bIndex;
      });
    }

    return thirds;
  }, [groups, rawTeamStats, savedPredictions?.thirdPlaceOrder]);

  // Build the final teamStats map including the qualified flag
  const teamStats = useMemo(() => {
    const statsMap = new Map<string, MockStats>();
    const bestThirdsIds = new Set(
      bestThirdsStandings.slice(0, 8).map((row) => row.team.id),
    );

    for (const group of groups) {
      for (let index = 0; index < group.teams.length; index++) {
        const team = group.teams[index];
        const raw = rawTeamStats.get(team.id) || {
          pts: 0,
          gf: 0,
          ga: 0,
          gd: 0,
          isAnyMatchPlayed: false,
        };
        const position = index + 1;

        let qualified = true;
        if (raw.isAnyMatchPlayed) {
          if (position === 1 || position === 2) {
            qualified = true;
          } else if (position === 3) {
            qualified = bestThirdsIds.has(team.id);
          } else {
            qualified = false;
          }
        }

        statsMap.set(team.id, {
          position,
          pts: raw.pts,
          gf: raw.gf,
          ga: raw.ga,
          gd: raw.gd,
          qualified,
        });
      }
    }
    return statsMap;
  }, [groups, rawTeamStats, bestThirdsStandings]);

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
    });
  }, [groups, savedPredictions, savedKnockoutWinners, savedAdvancement]);

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
                {groups.map((group) => {
                  const cutPosition = [
                    "A",
                    "B",
                    "C",
                    "D",
                    "E",
                    "F",
                    "G",
                    "H",
                  ].includes(group.group)
                    ? 3
                    : 2;
                  return (
                    <div
                      key={group.group}
                      className="rounded-xl border border-hairline bg-canvas p-4 shadow-sm dark:border-ash dark:bg-ink flex flex-col justify-between"
                    >
                      <div>
                        {/* Group Header */}
                        <div className="mb-3 flex items-center justify-between gap-2 border-b border-hairline pb-2 dark:border-ash">
                          <span className="font-display-campaign text-sm font-bold uppercase tracking-wider text-ink dark:text-canvas">
                            {tGroupStage("group", { letter: group.group })}
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
                            {group.teams.map((team, index) => {
                              const stats = teamStats.get(team.id) || {
                                position: index + 1,
                                pts: 0,
                                gf: 0,
                                ga: 0,
                                gd: 0,
                                qualified: true,
                              };
                              const gdSign =
                                stats.gd > 0 ? `+${stats.gd}` : stats.gd;
                              return (
                                <tr
                                  key={team.id}
                                  className={cn(
                                    "text-sm font-semibold transition-opacity duration-200",
                                    !stats.qualified && "opacity-50 grayscale",
                                  )}
                                >
                                  <td className="py-1.5 px-1 font-[family-name:var(--font-oswald)] text-xs text-mute dark:text-stone text-left">
                                    {stats.position}
                                  </td>
                                  <td className="py-1.5 px-1 w-full max-w-[150px]">
                                    <div className="flex items-center gap-1.5">
                                      <TeamBadge
                                        team={team}
                                        size="compact"
                                        border={false}
                                        showGrip={false}
                                      />
                                      {liveTeamIds.has(team.id) && (
                                        <span className="animate-pulse rounded px-1 py-0.5 text-[8px] font-bold uppercase tracking-wider bg-sale/10 text-sale dark:bg-sale/20 shrink-0">
                                          {t("liveMarker")}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-1.5 px-1.5 text-center font-[family-name:var(--font-oswald)] text-xs text-ink dark:text-canvas">
                                    {stats.pts}
                                  </td>
                                  <td className="py-1.5 px-1 text-center font-[family-name:var(--font-oswald)] text-xs text-ink dark:text-canvas">
                                    {stats.gf}
                                  </td>
                                  <td className="py-1.5 px-1 text-center font-[family-name:var(--font-oswald)] text-xs text-ink dark:text-canvas">
                                    {stats.ga}
                                  </td>
                                  <td
                                    className={cn(
                                      "py-1.5 px-1.5 text-center text-xs font-medium font-[family-name:var(--font-oswald)]",
                                      stats.gd > 0
                                        ? "text-success dark:text-success-bright"
                                        : stats.gd < 0
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
                    Clasifican 8
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
                    {bestThirdsStandings.map((row, index) => {
                      const position = index + 1;
                      const qualified = position <= 8;
                      const gdSign = row.gd > 0 ? `+${row.gd}` : row.gd;

                      return (
                        <tr
                          key={row.team.id}
                          className={cn(
                            "text-sm font-semibold transition-opacity duration-200",
                            !qualified && "opacity-50 grayscale",
                          )}
                        >
                          <td className="py-1.5 px-1 font-[family-name:var(--font-oswald)] text-xs text-mute dark:text-stone text-left">
                            {position}
                          </td>
                          <td className="py-1.5 px-1 w-full max-w-[150px]">
                            <div className="flex items-center gap-1">
                              <TeamBadge
                                team={row.team}
                                size="compact"
                                border={false}
                                showGrip={false}
                              />
                              <span className="text-[9px] uppercase font-bold text-mute dark:text-stone shrink-0">
                                ({row.groupLetter})
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
