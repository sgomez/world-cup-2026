"use client";

import { Trophy, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { TeamBadge } from "@/components/team-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { matchProgression, R32_MATCHUPS } from "@/lib/bracket-core";
import {
  getAllTeamsLookup,
  KNOCKOUT_MATCH_IDS,
  type KnockoutMatch,
} from "@/lib/prediction-state";
import { getGroups, type Team } from "@/lib/teams";
import { cn } from "@/lib/utils";
import { computeTournamentBracket } from "@/modules/tournament/domain/derive-result";

// Mock standings calculation mapping
type MockStats = {
  position: number;
  pts: number;
  gf: number;
  ga: number;
  gd: number;
  qualified: boolean;
};

function getMockGroupStats(index: number, _groupLetter: string): MockStats {
  // Clean all mockup values to 0 points/goals and set qualified to true as tournament hasn't started
  return {
    position: index + 1,
    pts: 0,
    gf: 0,
    ga: 0,
    gd: 0,
    qualified: true,
  };
}

// Helper to determine TBD slot labels (copied and adapted from calendar page)
// biome-ignore lint/suspicious/noExplicitAny: translator helper type
function getPlaceholderName(code: string, t: any): string {
  const matchWinner = code.match(/^W(\d+)$/);
  if (matchWinner) {
    return t("winnerMatch", { num: matchWinner[1] });
  }

  const matchLoser = code.match(/^L(\d+)$/);
  if (matchLoser) {
    return t("loserMatch", { num: matchLoser[1] });
  }

  const matchGroup = code.match(/^([12])([A-L])$/);
  if (matchGroup) {
    const position = matchGroup[1];
    const group = matchGroup[2];
    if (position === "1") {
      return t("winnerGroup", { group });
    }
    return t("runnerUpGroup", { group });
  }

  if (code.startsWith("3")) {
    const groups = code.substring(1);
    return t("bestThird", { groups });
  }

  return code;
}

// Generate the placeholder code for any knockout match slot
function getKnockoutPlaceholder(matchId: string, slot: 1 | 2): string {
  if (matchId.startsWith("R32-")) {
    const num = parseInt(matchId.replace("R32-", ""), 10);
    const matchup = R32_MATCHUPS.find((m) => m.num === num);
    if (matchup) {
      const ref = slot === 1 ? matchup.team1 : matchup.team2;
      return ref || `3rd-${matchup.team1}`;
    }
  }

  // Reverse lookup matchProgression to see which match feeds this slot
  const entry = Object.entries(matchProgression).find(
    ([_, val]) => val.nextMatch === matchId && val.slot === slot,
  );
  if (entry) {
    const sourceMatchId = entry[0];
    const sourceNum = sourceMatchId.split("-")[1];
    return `W${sourceNum}`;
  }

  if (matchId === "3RD") {
    return slot === 1 ? "L101" : "L102";
  }
  if (matchId === "F") {
    return slot === 1 ? "W101" : "W102";
  }

  return "TBD";
}

export function StandingsView({
  defaultTab,
  locale,
  savedPredictions = null,
  savedKnockoutWinners = null,
  savedAdvancement = [],
}: {
  defaultTab: "groups" | "knockout";
  locale: string;
  savedPredictions?: {
    groupOrders: Record<string, string[]>;
    thirdPlaceOrder: string[];
  } | null;
  savedKnockoutWinners?: Record<string, string> | null;
  savedAdvancement?: string[];
}) {
  const t = useTranslations("tournament");
  const tGroupStage = useTranslations("groupStage");
  const tKnockout = useTranslations("knockoutStage");
  const tCalendar = useTranslations("calendar");

  const [activeTab, setActiveTab] = useState<string>(defaultTab);

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

  // Compute the Best Third-place Teams standings table
  const bestThirdsStandings = useMemo(() => {
    const thirds = groups.map((g) => {
      const team = g.teams[2]; // 3rd place team in ordered array
      const stats = getMockGroupStats(2, g.group);
      return { team, groupLetter: g.group, ...stats };
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
  }, [groups, savedPredictions?.thirdPlaceOrder]);

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

  // Match scores mapping (all empty since tournament hasn't started)
  const mockMatchScores = useMemo<
    Record<
      string,
      {
        score1: string;
        score2: string;
        score1Pen?: string;
        score2Pen?: string;
      }
    >
  >(() => {
    return {};
  }, []);

  // Check if a match is finished
  const isMatchFinished = (matchId: string, match: KnockoutMatch) => {
    return !!mockMatchScores[matchId] && !!match.winnerId;
  };

  // Check if a match is upcoming (i.e. participants resolved, but not finished)
  const isMatchUpcoming = (match: KnockoutMatch) => {
    return !!match.team1Id && !!match.team2Id && !mockMatchScores[match.id];
  };

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
                              const stats = getMockGroupStats(
                                index,
                                group.group,
                              );
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
                                    <TeamBadge
                                      team={team}
                                      size="compact"
                                      border={false}
                                      showGrip={false}
                                    />
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
          {Object.entries(KNOCKOUT_MATCH_IDS).map(
            ([roundName, matchIds], _rIndex) => {
              // Get proper round title
              let roundTitle = roundName;
              let accentColor = "bg-cyan-500";
              if (roundName === "R32") {
                roundTitle = tKnockout("roundOf32");
                accentColor = "bg-cyan-500";
              } else if (roundName === "R16") {
                roundTitle = tKnockout("roundOf16");
                accentColor = "bg-cyan-500";
              } else if (roundName === "QF") {
                roundTitle = tKnockout("quarterFinals");
                accentColor = "bg-amber-500";
              } else if (roundName === "SF") {
                roundTitle = tKnockout("semiFinals");
                accentColor = "bg-amber-500";
              } else if (roundName === "3RD") {
                roundTitle = tKnockout("thirdPlaceMatch");
                accentColor = "bg-rose-500";
              } else if (roundName === "F") {
                roundTitle = tKnockout("final");
                accentColor = "bg-emerald-500";
              }

              const teamsLookup = getAllTeamsLookup(locale);
              const matches = matchIds.map((matchId, _i) => {
                const match = bracketMatches[matchId];
                return {
                  matchId,
                  matchNumber: matchId.includes("-")
                    ? parseInt(matchId.split("-")[1], 10)
                    : 103, // 103 for 3RD, 104 for F
                  team1: match?.team1Id
                    ? (teamsLookup.get(match.team1Id) ?? null)
                    : null,
                  team2: match?.team2Id
                    ? (teamsLookup.get(match.team2Id) ?? null)
                    : null,
                  winnerId: match?.winnerId ?? null,
                  matchObj: match,
                };
              });

              // Grid column classes depending on match count in round
              let gridColsClass = "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";
              if (roundName === "R16") {
                gridColsClass = "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";
              } else if (roundName === "QF") {
                gridColsClass = "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";
              } else if (
                roundName === "SF" ||
                roundName === "3RD" ||
                roundName === "F"
              ) {
                gridColsClass = "grid-cols-1 sm:grid-cols-2 max-w-2xl";
              }

              return (
                <div
                  key={roundName}
                  className="rounded-xl border border-hairline bg-canvas/60 p-4 shadow-sm dark:border-ash dark:bg-ink/40"
                >
                  {/* Round Header */}
                  <div className="mb-4 flex items-center gap-2">
                    <div className={cn("h-4 w-1 rounded-full", accentColor)} />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-ink dark:text-canvas">
                      {roundTitle}
                    </h3>
                    <span className="text-xs text-mute dark:text-stone font-semibold">
                      ({tKnockout("matchCount", { count: matchIds.length })})
                    </span>
                  </div>

                  {/* Match Grid */}
                  <div className={cn("grid gap-4", gridColsClass)}>
                    {matches.map(
                      ({
                        matchId,
                        matchNumber,
                        team1,
                        team2,
                        winnerId,
                        matchObj,
                      }) => {
                        const scores = mockMatchScores[matchId];
                        const finished = isMatchFinished(matchId, matchObj);
                        const upcoming = isMatchUpcoming(matchObj);

                        const team1Code = team1
                          ? team1.id
                          : getKnockoutPlaceholder(matchId, 1);
                        const team2Code = team2
                          ? team2.id
                          : getKnockoutPlaceholder(matchId, 2);

                        const team1Label = team1
                          ? team1.name
                          : getPlaceholderName(team1Code, tCalendar);
                        const team2Label = team2
                          ? team2.name
                          : getPlaceholderName(team2Code, tCalendar);

                        // Penalties displays
                        const pen1 = scores?.score1Pen
                          ? `(${scores.score1Pen})`
                          : "";
                        const pen2 = scores?.score2Pen
                          ? `(${scores.score2Pen})`
                          : "";

                        return (
                          <div
                            key={matchId}
                            className="rounded-lg border border-hairline bg-canvas p-3 shadow-sm dark:border-ash dark:bg-ink flex flex-col justify-between"
                          >
                            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-mute dark:text-stone border-b border-hairline/25 pb-1 dark:border-ash/25 flex items-center justify-between">
                              <span>
                                {tKnockout("match", { number: matchNumber })}
                              </span>
                              {finished ? (
                                <span className="text-mute/70 dark:text-stone/70 font-semibold">
                                  {tCalendar("finished")}
                                </span>
                              ) : upcoming ? (
                                <span className="text-primary font-bold animate-pulse flex items-center gap-1">
                                  <span className="h-1 w-1 rounded-full bg-primary" />
                                  {tCalendar("upcoming")}
                                </span>
                              ) : (
                                <span className="text-mute/40 dark:text-stone/40 font-semibold">
                                  TBD
                                </span>
                              )}
                            </div>

                            <div className="flex flex-col gap-1.5 select-none">
                              {/* Team 1 Row */}
                              <div
                                className={cn(
                                  "flex items-center justify-between gap-2 rounded-md",
                                  finished &&
                                    winnerId !== team1?.id &&
                                    "opacity-45 grayscale",
                                )}
                              >
                                <div className="w-full min-w-0">
                                  {team1 ? (
                                    <TeamBadge
                                      team={team1}
                                      size="compact"
                                      border={false}
                                      showGrip={false}
                                      matched={
                                        finished && winnerId === team1?.id
                                      }
                                      rightAddon={
                                        finished && scores ? (
                                          <div
                                            className={cn(
                                              "flex items-center gap-1 font-[family-name:var(--font-oswald)] text-xs font-bold shrink-0 pr-1",
                                              finished && winnerId === team1?.id
                                                ? "text-success dark:text-success-bright"
                                                : "text-ink dark:text-canvas",
                                            )}
                                          >
                                            <span>{scores.score1}</span>
                                            {pen1 && (
                                              <span className="text-[10px] text-mute dark:text-stone font-semibold">
                                                {pen1}
                                              </span>
                                            )}
                                          </div>
                                        ) : null
                                      }
                                    />
                                  ) : (
                                    <div className="flex items-center gap-2 rounded bg-soft-cloud/30 px-2 py-1.5 border border-dashed border-hairline/50 dark:bg-charcoal/30 dark:border-ash/50 h-8">
                                      <div className="h-4 w-4 shrink-0 rounded-sm bg-soft-cloud dark:bg-charcoal flex items-center justify-center text-[10px] font-bold text-mute/50">
                                        ?
                                      </div>
                                      <span className="text-[11px] font-[family-name:var(--font-oswald)] uppercase text-mute/60 dark:text-stone/60 truncate tracking-wide">
                                        {team1Label}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Team 2 Row */}
                              <div
                                className={cn(
                                  "flex items-center justify-between gap-2 rounded-md",
                                  finished &&
                                    winnerId !== team2?.id &&
                                    "opacity-45 grayscale",
                                )}
                              >
                                <div className="w-full min-w-0">
                                  {team2 ? (
                                    <TeamBadge
                                      team={team2}
                                      size="compact"
                                      border={false}
                                      showGrip={false}
                                      matched={
                                        finished && winnerId === team2?.id
                                      }
                                      rightAddon={
                                        finished && scores ? (
                                          <div
                                            className={cn(
                                              "flex items-center gap-1 font-[family-name:var(--font-oswald)] text-xs font-bold shrink-0 pr-1",
                                              finished && winnerId === team2?.id
                                                ? "text-success dark:text-success-bright"
                                                : "text-ink dark:text-canvas",
                                            )}
                                          >
                                            <span>{scores.score2}</span>
                                            {pen2 && (
                                              <span className="text-[10px] text-mute dark:text-stone font-semibold">
                                                {pen2}
                                              </span>
                                            )}
                                          </div>
                                        ) : null
                                      }
                                    />
                                  ) : (
                                    <div className="flex items-center gap-2 rounded bg-soft-cloud/30 px-2 py-1.5 border border-dashed border-hairline/50 dark:bg-charcoal/30 dark:border-ash/50 h-8">
                                      <div className="h-4 w-4 shrink-0 rounded-sm bg-soft-cloud dark:bg-charcoal flex items-center justify-center text-[10px] font-bold text-mute/50">
                                        ?
                                      </div>
                                      <span className="text-[11px] font-[family-name:var(--font-oswald)] uppercase text-mute/60 dark:text-stone/60 truncate tracking-wide">
                                        {team2Label}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>
                </div>
              );
            },
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
