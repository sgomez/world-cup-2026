"use client";

import { CalendarDays, Filter, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { upsertLiveResultAction } from "@/app/actions/live";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type {
  LiveResultState,
  LiveStatus,
} from "@/modules/live/domain/live-result";
import type { Match } from "@/modules/schedule";
import { getGroups, getTeamById, getTeamByName } from "@/modules/teams";

// Match number to bracket match ID map for knockout rounds
const NUM_TO_BRACKET_ID: Record<number, string> = {
  ...Object.fromEntries(
    [73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88].map(
      (n) => [n, `R32-${n}`],
    ),
  ),
  ...Object.fromEntries(
    [89, 90, 91, 92, 93, 94, 95, 96].map((n) => [n, `R16-${n}`]),
  ),
  ...Object.fromEntries([97, 98, 99, 100].map((n) => [n, `QF-${n}`])),
  101: "SF-101",
  102: "SF-102",
  103: "3RD",
  104: "F",
};

// Helper to convert date & time to local YYYY-MM-DD
const getLocalDateString = (dateStr: string, timeStr: string) => {
  const offsetMatch = timeStr.match(/UTC([-+]\d+)/);
  let parsedOffset = "";
  if (offsetMatch) {
    const val = parseInt(offsetMatch[1], 10);
    const sign = val >= 0 ? "+" : "-";
    const absVal = Math.abs(val);
    const padded = String(absVal).padStart(2, "0");
    parsedOffset = `${sign}${padded}:00`;
  } else {
    parsedOffset = "Z";
  }

  const timePortionMatch = timeStr.match(/^(\d{2}:\d{2})/);
  const timePortion = timePortionMatch ? timePortionMatch[1] : "00:00";

  try {
    const isoStr = `${dateStr}T${timePortion}${parsedOffset}`;
    const dateObj = new Date(isoStr);
    if (Number.isNaN(dateObj.getTime())) return dateStr;

    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
    const dd = String(dateObj.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return dateStr;
  }
};

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
    } else {
      return t("runnerUpGroup", { group });
    }
  }

  if (code.startsWith("3")) {
    const groups = code.substring(1);
    return t("bestThird", { groups });
  }

  return code;
}

export function AdminMatchScoreEditor({
  matches,
  liveResults,
  bracketView,
  locale,
}: {
  matches: Match[];
  liveResults: LiveResultState[];
  bracketView: Record<string, any>;
  locale: string;
}) {
  const tCalendar = useTranslations("calendar");
  const tKnock = useTranslations("knockoutStage");
  const tAdmin = useTranslations("adminMatchEditor");

  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [selectedPhase, setSelectedPhase] = useState<string>("");
  const [isMounted, setIsMounted] = useState(false);
  const [_userTimezone, setUserTimezone] = useState("");

  const liveByNum = useMemo(() => {
    const map = new Map<number, LiveResultState>();
    for (const lr of liveResults) {
      map.set(lr.num, lr);
    }
    return map;
  }, [liveResults]);

  useEffect(() => {
    setIsMounted(true);
    try {
      setUserTimezone(
        Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      );
    } catch {
      setUserTimezone("UTC");
    }
  }, []);

  const allTeams = useMemo(() => {
    const groups = getGroups(locale);
    const teams = groups.flatMap((g) => g.teams);
    return [...teams].sort((a, b) => a.name.localeCompare(b.name, locale));
  }, [locale]);

  const processedMatches = useMemo(() => {
    return matches.map((match) => {
      let phase = "Group Stage";
      const round = match.round;

      if (round.startsWith("Matchday")) {
        phase = "Group Stage";
      } else if (
        [
          "Round of 32",
          "Round of 16",
          "Quarter-final",
          "Semi-final",
          "Match for third place",
          "Final",
        ].includes(round)
      ) {
        phase = round;
      }

      const localDate = isMounted
        ? getLocalDateString(match.date, match.time)
        : match.date;

      return {
        ...match,
        phase,
        localDate,
      };
    });
  }, [matches, isMounted]);

  const filteredMatches = useMemo(() => {
    return processedMatches.filter((match) => {
      // Filter by Phase or Group
      if (selectedPhase) {
        if (/^Group [A-Z]$/.test(selectedPhase)) {
          if (match.group !== selectedPhase) return false;
        } else if (match.phase !== selectedPhase) {
          return false;
        }
      }

      // Filter by Team
      if (selectedTeam) {
        const num = match.num;
        const bracketId = NUM_TO_BRACKET_ID[num];
        const bracketMatch = bracketId ? bracketView[bracketId] : null;

        const team1Id = bracketMatch?.team1Id || match.team1;
        const team2Id = bracketMatch?.team2Id || match.team2;

        let t1 = getTeamById(team1Id, locale);
        if (!t1) {
          t1 = getTeamByName(team1Id, locale);
        }
        let t2 = getTeamById(team2Id, locale);
        if (!t2) {
          t2 = getTeamByName(team2Id, locale);
        }

        const t1Id = t1?.id || team1Id.toLowerCase();
        const t2Id = t2?.id || team2Id.toLowerCase();

        if (t1Id !== selectedTeam && t2Id !== selectedTeam) {
          return false;
        }
      }

      return true;
    });
  }, [processedMatches, selectedTeam, selectedPhase, locale, bracketView]);

  const groupedMatches = useMemo(() => {
    const groups: Record<string, Record<string, typeof processedMatches>> = {};

    for (const match of filteredMatches) {
      const phase = match.phase;
      const date = match.localDate || match.date;

      if (!groups[phase]) {
        groups[phase] = {};
      }
      if (!groups[phase][date]) {
        groups[phase][date] = [];
      }
      groups[phase][date].push(match);
    }

    return groups;
  }, [filteredMatches]);

  const phases = useMemo(() => {
    const order = [
      "Group Stage",
      "Round of 32",
      "Round of 16",
      "Quarter-final",
      "Semi-final",
      "Match for third place",
      "Final",
    ];
    return order.filter((p) =>
      processedMatches.some((match) => match.phase === p),
    );
  }, [processedMatches]);

  const availableGroups = useMemo(() => {
    const seen = new Set<string>();
    const groups: string[] = [];
    for (const match of processedMatches) {
      if (
        match.phase === "Group Stage" &&
        match.group &&
        !seen.has(match.group)
      ) {
        seen.add(match.group);
        groups.push(match.group);
      }
    }
    return groups.sort();
  }, [processedMatches]);

  const getPhaseTranslation = (phase: string) => {
    switch (phase) {
      case "Group Stage":
        return tCalendar("groupStage");
      case "Round of 32":
        return tKnock("roundOf32");
      case "Round of 16":
        return tKnock("roundOf16");
      case "Quarter-final":
        return tKnock("quarterFinals");
      case "Semi-final":
        return tKnock("semiFinals");
      case "Match for third place":
        return tKnock("thirdPlaceMatch");
      case "Final":
        return tKnock("final");
      default:
        return phase;
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(`${dateStr}T00:00:00`);
      return new Intl.DateTimeFormat(locale, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(date);
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-hairline bg-canvas p-4 shadow-sm dark:border-ash dark:bg-ink">
        <div className="flex items-center gap-2 text-ink dark:text-canvas">
          <Filter className="h-4 w-4 text-mute dark:text-stone" />
          <span className="text-xs font-bold uppercase tracking-wider">
            {tAdmin("filterTitle", { defaultValue: "Filters" })}
          </span>
        </div>

        {/* Phase Filter */}
        <select
          value={selectedPhase}
          onChange={(e) => setSelectedPhase(e.target.value)}
          className="h-9 rounded-md border border-hairline bg-soft-cloud px-3 text-xs font-medium text-ink focus:border-info focus:outline-none dark:border-ash dark:bg-charcoal dark:text-canvas"
        >
          <option value="">{tCalendar("allPhases")}</option>
          {availableGroups.map((g) => (
            <option key={g} value={g}>
              {tAdmin("groupLabel", { group: g.replace("Group ", "") })}
            </option>
          ))}
          {phases
            .filter((p) => p !== "Group Stage")
            .map((p) => (
              <option key={p} value={p}>
                {getPhaseTranslation(p)}
              </option>
            ))}
        </select>

        {/* Team Filter */}
        <select
          value={selectedTeam}
          onChange={(e) => setSelectedTeam(e.target.value)}
          className="h-9 rounded-md border border-hairline bg-soft-cloud px-3 text-xs font-medium text-ink focus:border-info focus:outline-none dark:border-ash dark:bg-charcoal dark:text-canvas"
        >
          <option value="">{tCalendar("allTeams")}</option>
          {allTeams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {/* Matches editor list */}
      <div className="space-y-8">
        {phases.map((phase) => {
          const datesObj = groupedMatches[phase];
          if (!datesObj || Object.keys(datesObj).length === 0) return null;

          const sortedDates = Object.keys(datesObj).sort();

          return (
            <div key={phase} className="space-y-4">
              <div className="border-b border-hairline pb-2 dark:border-ash">
                <h2 className="font-[family-name:var(--font-oswald)] text-xl font-bold uppercase tracking-wider text-ink dark:text-canvas">
                  {getPhaseTranslation(phase)}
                </h2>
              </div>

              <div className="space-y-6">
                {sortedDates.map((dateStr) => {
                  const dateMatches = datesObj[dateStr];
                  return (
                    <div key={dateStr} className="space-y-3">
                      <h3 className="text-sm font-bold text-ink dark:text-canvas flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-mute dark:text-stone" />
                        {formatDate(dateStr)}
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {dateMatches.map((match) => (
                          <MatchEditorCard
                            key={match.num}
                            match={match}
                            initialResult={liveByNum.get(match.num)}
                            bracketView={bracketView}
                            locale={locale}
                            tCalendar={tCalendar}
                            tAdmin={tAdmin}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MatchEditorCard({
  match,
  initialResult,
  bracketView,
  locale,
  tCalendar,
  tAdmin,
}: {
  match: Match;
  initialResult?: LiveResultState;
  bracketView: Record<string, any>;
  locale: string;
  tCalendar: any;
  tAdmin: any;
}) {
  const { toast } = useToast();
  const [status, setStatus] = useState<LiveStatus>(
    initialResult?.status ?? "upcoming",
  );
  const [goals1, setGoals1] = useState<number>(initialResult?.goals1 ?? 0);
  const [goals2, setGoals2] = useState<number>(initialResult?.goals2 ?? 0);
  const [penalties1, setPenalties1] = useState<string>(
    initialResult?.penalties1 !== undefined
      ? String(initialResult.penalties1)
      : "",
  );
  const [penalties2, setPenalties2] = useState<string>(
    initialResult?.penalties2 !== undefined
      ? String(initialResult.penalties2)
      : "",
  );

  const [isSaving, setIsSaving] = useState(false);

  // Keep track of last saved values to prevent redundant server calls
  const lastSavedRef = useRef({
    status: initialResult?.status ?? "upcoming",
    goals1: initialResult?.goals1 ?? 0,
    goals2: initialResult?.goals2 ?? 0,
    penalties1:
      initialResult?.penalties1 !== undefined
        ? String(initialResult.penalties1)
        : "",
    penalties2:
      initialResult?.penalties2 !== undefined
        ? String(initialResult.penalties2)
        : "",
  });

  // Sync state with props if database updates occur externally
  useEffect(() => {
    setStatus(initialResult?.status ?? "upcoming");
    setGoals1(initialResult?.goals1 ?? 0);
    setGoals2(initialResult?.goals2 ?? 0);
    const p1 =
      initialResult?.penalties1 !== undefined
        ? String(initialResult.penalties1)
        : "";
    const p2 =
      initialResult?.penalties2 !== undefined
        ? String(initialResult.penalties2)
        : "";
    setPenalties1(p1);
    setPenalties2(p2);

    lastSavedRef.current = {
      status: initialResult?.status ?? "upcoming",
      goals1: initialResult?.goals1 ?? 0,
      goals2: initialResult?.goals2 ?? 0,
      penalties1: p1,
      penalties2: p2,
    };
  }, [initialResult]);

  const isKnockout = match.num >= 73;

  // Resolve team info
  const bracketId = NUM_TO_BRACKET_ID[match.num];
  const bracketMatch = bracketId ? bracketView[bracketId] : null;

  const team1Id = bracketMatch?.team1Id || match.team1;
  const team2Id = bracketMatch?.team2Id || match.team2;

  let t1 = getTeamById(team1Id, locale);
  if (!t1) {
    t1 = getTeamByName(team1Id, locale);
  }
  let t2 = getTeamById(team2Id, locale);
  if (!t2) {
    t2 = getTeamByName(team2Id, locale);
  }

  const t1Label = t1 ? t1.name : getPlaceholderName(team1Id, tCalendar);
  const t2Label = t2 ? t2.name : getPlaceholderName(team2Id, tCalendar);

  const save = async (vals: {
    status: LiveStatus;
    goals1: number;
    goals2: number;
    penalties1: string;
    penalties2: string;
  }) => {
    const isUpcoming = vals.status === "upcoming";
    const finalGoals1 = isUpcoming ? 0 : vals.goals1;
    const finalGoals2 = isUpcoming ? 0 : vals.goals2;

    const isFinished = vals.status === "finished";
    const isTied = finalGoals1 === finalGoals2;
    const hasBothPenalties = vals.penalties1 !== "" && vals.penalties2 !== "";
    const finalPen1 =
      !isUpcoming && isKnockout && isFinished && isTied && hasBothPenalties
        ? parseInt(vals.penalties1, 10)
        : undefined;
    const finalPen2 =
      !isUpcoming && isKnockout && isFinished && isTied && hasBothPenalties
        ? parseInt(vals.penalties2, 10)
        : undefined;

    const finalPenStr1 = finalPen1 !== undefined ? String(finalPen1) : "";
    const finalPenStr2 = finalPen2 !== undefined ? String(finalPen2) : "";

    const last = lastSavedRef.current;
    if (
      last.status === vals.status &&
      last.goals1 === finalGoals1 &&
      last.goals2 === finalGoals2 &&
      last.penalties1 === finalPenStr1 &&
      last.penalties2 === finalPenStr2
    ) {
      return; // No changes to save
    }

    setIsSaving(true);
    try {
      const result = await upsertLiveResultAction({
        num: match.num,
        status: vals.status,
        goals1: finalGoals1,
        goals2: finalGoals2,
        ...(finalPen1 !== undefined ? { penalties1: finalPen1 } : {}),
        ...(finalPen2 !== undefined ? { penalties2: finalPen2 } : {}),
        allowCreate: true,
        adminOverride: true,
      });

      if (result?.error) {
        toast(result.error, "error");
      } else {
        toast(tAdmin("savedSuccess"), "success");
        lastSavedRef.current = {
          status: vals.status,
          goals1: finalGoals1,
          goals2: finalGoals2,
          penalties1: finalPenStr1,
          penalties2: finalPenStr2,
        };
      }
    } catch (e) {
      console.error(e);
      toast("An unexpected error occurred", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = (newStatus: LiveStatus) => {
    setStatus(newStatus);
    let updatedGoals1 = goals1;
    let updatedGoals2 = goals2;
    let updatedPen1 = penalties1;
    let updatedPen2 = penalties2;

    if (newStatus === "upcoming") {
      updatedGoals1 = 0;
      updatedGoals2 = 0;
      updatedPen1 = "";
      updatedPen2 = "";
      setGoals1(0);
      setGoals2(0);
      setPenalties1("");
      setPenalties2("");
    }
    save({
      status: newStatus,
      goals1: updatedGoals1,
      goals2: updatedGoals2,
      penalties1: updatedPen1,
      penalties2: updatedPen2,
    });
  };

  const handleBlur = () => {
    save({ status, goals1, goals2, penalties1, penalties2 });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    }
  };

  const showPenaltiesInput =
    isKnockout && status === "finished" && goals1 === goals2;

  return (
    <div
      className={cn(
        "rounded-xl border border-hairline bg-canvas p-4 shadow-sm transition-all duration-200 dark:border-ash dark:bg-ink flex flex-col justify-between",
        status === "live" &&
          "border-sale/40 bg-sale/5 dark:border-sale/30 dark:bg-sale/10",
        isSaving &&
          "border-info/40 bg-info/5 dark:border-info/30 dark:bg-info/10",
      )}
    >
      <div>
        {/* Card Header */}
        <div className="mb-3 flex items-center justify-between gap-2 border-b border-hairline pb-2 dark:border-ash">
          <div className="flex items-center gap-2">
            <span className="font-[family-name:var(--font-oswald)] text-xs font-bold uppercase tracking-wider text-mute dark:text-stone">
              {tAdmin("matchLabel", { num: match.num })}
            </span>
            {match.group && (
              <span className="rounded-full bg-soft-cloud px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-mute dark:bg-charcoal dark:text-stone">
                {tAdmin("groupLabel", {
                  group: match.group.replace("Group ", ""),
                })}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {isSaving && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-info" />
            )}
            <select
              value={status}
              onChange={(e) => handleStatusChange(e.target.value as LiveStatus)}
              disabled={isSaving}
              className={cn(
                "h-7 rounded px-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors focus:outline-none focus:ring-1 focus:ring-info",
                status === "finished" &&
                  "bg-success/10 text-success dark:bg-success/20",
                status === "live" && "bg-sale/10 text-sale dark:bg-sale/20",
                status === "upcoming" &&
                  "bg-soft-cloud text-mute dark:bg-charcoal dark:text-stone",
              )}
            >
              <option
                value="upcoming"
                className="bg-canvas text-ink dark:bg-ink dark:text-canvas"
              >
                {tAdmin("statusUpcoming")}
              </option>
              <option
                value="live"
                className="bg-canvas text-ink dark:bg-ink dark:text-canvas"
              >
                {tAdmin("statusLive")}
              </option>
              <option
                value="finished"
                className="bg-canvas text-ink dark:bg-ink dark:text-canvas"
              >
                {tAdmin("statusFinished")}
              </option>
            </select>
          </div>
        </div>

        {/* Teams + Score Grid */}
        <div className="space-y-3">
          {/* Team 1 Row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {t1 ? (
                <>
                  <img
                    src={`https://flagcdn.com/w40/${t1.code.toLowerCase()}.png`}
                    alt={t1.name}
                    className="h-4 w-6 rounded border border-hairline object-cover dark:border-ash shrink-0"
                  />
                  <span className="truncate text-xs font-semibold text-ink dark:text-canvas">
                    {t1Label}
                  </span>
                </>
              ) : (
                <span className="truncate text-xs font-semibold text-mute/70 dark:text-stone/70 italic">
                  {t1Label}
                </span>
              )}
            </div>
            <input
              type="number"
              min={0}
              value={status === "upcoming" ? "" : goals1}
              disabled={status === "upcoming" || isSaving}
              placeholder="0"
              onChange={(e) => {
                const val =
                  e.target.value === ""
                    ? 0
                    : Math.max(0, parseInt(e.target.value, 10) || 0);
                setGoals1(val);
              }}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="h-8 w-11 rounded border border-hairline bg-soft-cloud text-center font-[family-name:var(--font-oswald)] text-sm font-bold text-ink focus:border-info focus:outline-none dark:border-ash dark:bg-charcoal dark:text-canvas disabled:opacity-40"
              aria-label={tAdmin("goals1Label")}
            />
          </div>

          {/* Team 2 Row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {t2 ? (
                <>
                  <img
                    src={`https://flagcdn.com/w40/${t2.code.toLowerCase()}.png`}
                    alt={t2.name}
                    className="h-4 w-6 rounded border border-hairline object-cover dark:border-ash shrink-0"
                  />
                  <span className="truncate text-xs font-semibold text-ink dark:text-canvas">
                    {t2Label}
                  </span>
                </>
              ) : (
                <span className="truncate text-xs font-semibold text-mute/70 dark:text-stone/70 italic">
                  {t2Label}
                </span>
              )}
            </div>
            <input
              type="number"
              min={0}
              value={status === "upcoming" ? "" : goals2}
              disabled={status === "upcoming" || isSaving}
              placeholder="0"
              onChange={(e) => {
                const val =
                  e.target.value === ""
                    ? 0
                    : Math.max(0, parseInt(e.target.value, 10) || 0);
                setGoals2(val);
              }}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="h-8 w-11 rounded border border-hairline bg-soft-cloud text-center font-[family-name:var(--font-oswald)] text-sm font-bold text-ink focus:border-info focus:outline-none dark:border-ash dark:bg-charcoal dark:text-canvas disabled:opacity-40"
              aria-label={tAdmin("goals2Label")}
            />
          </div>
        </div>

        {/* Penalties section (knockout matches) */}
        {isKnockout && (
          <div
            className={cn(
              "mt-3 pt-2 border-t border-hairline/50 dark:border-ash/50 transition-opacity duration-200",
              !showPenaltiesInput && "opacity-30 pointer-events-none",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-mute dark:text-stone">
                {tAdmin("penaltiesTitle", { defaultValue: "Penalties" })}
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  placeholder="–"
                  value={penalties1}
                  disabled={!showPenaltiesInput || isSaving}
                  onChange={(e) => {
                    const val =
                      e.target.value === ""
                        ? ""
                        : String(
                            Math.max(0, parseInt(e.target.value, 10) || 0),
                          );
                    setPenalties1(val);
                  }}
                  onBlur={handleBlur}
                  onKeyDown={handleKeyDown}
                  className="h-7 w-10 rounded border border-hairline bg-soft-cloud/60 text-center font-[family-name:var(--font-oswald)] text-xs text-ink focus:border-info focus:outline-none dark:border-ash dark:bg-charcoal/60 dark:text-canvas"
                  aria-label={tAdmin("penalties1Label")}
                />
                <span className="text-[10px] font-bold text-mute dark:text-stone">
                  –
                </span>
                <input
                  type="number"
                  min={0}
                  placeholder="–"
                  value={penalties2}
                  disabled={!showPenaltiesInput || isSaving}
                  onChange={(e) => {
                    const val =
                      e.target.value === ""
                        ? ""
                        : String(
                            Math.max(0, parseInt(e.target.value, 10) || 0),
                          );
                    setPenalties2(val);
                  }}
                  onBlur={handleBlur}
                  onKeyDown={handleKeyDown}
                  className="h-7 w-10 rounded border border-hairline bg-soft-cloud/60 text-center font-[family-name:var(--font-oswald)] text-xs text-ink focus:border-info focus:outline-none dark:border-ash dark:bg-charcoal/60 dark:text-canvas"
                  aria-label={tAdmin("penalties2Label")}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
