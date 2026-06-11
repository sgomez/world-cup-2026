"use client";

import { CalendarDays, Filter, Globe, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import worldcupData from "@/../data/worldcup.json";
import { MatchCard } from "@/components/match-card";
import { useRouter } from "@/i18n/navigation";
import type { KnockoutMatch } from "@/lib/bracket-core";
import { getGroups, getTeamById, getTeamByName } from "@/lib/teams";
import type { LiveResultState } from "@/modules/live/domain/live-result";

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

type Match = {
  round: string;
  date: string;
  time: string;
  team1: string;
  team2: string;
  group?: string;
  ground: string;
  num?: number;
};

// Helper to convert date & time to local YYYY-MM-DD (outside component)
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

// Helper to get today's YYYY-MM-DD (outside component)
const getTodayDateString = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export type CalendarViewProps = {
  liveResults: LiveResultState[];
  bracketView: Record<string, KnockoutMatch>;
  locale: string;
};

export function CalendarView({
  liveResults,
  bracketView,
  locale,
}: CalendarViewProps) {
  const router = useRouter();
  const tCalendar = useTranslations("calendar");
  const tKnock = useTranslations("knockoutStage");

  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [selectedPhase, setSelectedPhase] = useState<string>("");
  const [isMounted, setIsMounted] = useState(false);
  const [userTimezone, setUserTimezone] = useState("");

  // Build a map of num → LiveResult for fast lookup
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

  // Auto-refresh every 30s when the tab is visible
  useEffect(() => {
    if (!isMounted) return;

    const REFRESH_INTERVAL = 30_000;
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

  // Get all teams from groups, sorted alphabetically
  const allTeams = useMemo(() => {
    const groups = getGroups(locale);
    const teams = groups.flatMap((g) => g.teams);
    return [...teams].sort((a, b) => a.name.localeCompare(b.name, locale));
  }, [locale]);

  // Standardize matches and determine their phase & local dates
  const processedMatches = useMemo(() => {
    const matches: Match[] = worldcupData.matches;

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

      // Calculate localized date string
      const localDate = isMounted
        ? getLocalDateString(match.date, match.time)
        : match.date;

      return {
        ...match,
        phase,
        localDate,
      };
    });
  }, [isMounted]);

  // Filter matches based on user selections
  const filteredMatches = useMemo(() => {
    return processedMatches.filter((match) => {
      // Filter by Phase
      if (selectedPhase && match.phase !== selectedPhase) {
        return false;
      }

      // Filter by Team
      if (selectedTeam) {
        const t1 = getTeamByName(match.team1, locale);
        const t2 = getTeamByName(match.team2, locale);
        const t1Id = t1?.id || match.team1.toLowerCase();
        const t2Id = t2?.id || match.team2.toLowerCase();

        // Also check bracket-resolved IDs for knockout matches
        const num = match.num;
        if (num) {
          const bracketId = NUM_TO_BRACKET_ID[num];
          if (bracketId) {
            const bracketMatch = bracketView[bracketId];
            const resolved1 = bracketMatch?.team1Id ?? t1Id;
            const resolved2 = bracketMatch?.team2Id ?? t2Id;
            if (resolved1 !== selectedTeam && resolved2 !== selectedTeam) {
              return false;
            }
            return true;
          }
        }

        if (t1Id !== selectedTeam && t2Id !== selectedTeam) {
          return false;
        }
      }

      return true;
    });
  }, [processedMatches, selectedTeam, selectedPhase, locale, bracketView]);

  // Group matches by Phase, then by local date
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

  // Get phases in their chronological order
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
    // Return order elements present in raw matches
    return order.filter((p) =>
      processedMatches.some((match) => match.phase === p),
    );
  }, [processedMatches]);

  // Get localized phase translation
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

  // Format date helper
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

  // Scroll to today's matches
  const jumpToToday = useCallback(() => {
    let todayStr = getTodayDateString();

    // For mockup purposes: if today is outside the tournament dates (June 11, 2026 to July 19, 2026),
    // default todayStr to the inaugural matchday '2026-06-11' so the mockup shows the live match scrolling!
    const todaySec = new Date(todayStr).getTime();
    const startSec = new Date("2026-06-11").getTime();
    const endSec = new Date("2026-07-19").getTime();
    if (todaySec < startSec || todaySec > endSec) {
      todayStr = "2026-06-11";
    }

    const element = document.getElementById(`day-${todayStr}`);
    if (element) {
      // Calculate header offset (navbar height ~ 56px + sticky controls ~ 72px)
      const offset = 135;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.scrollY - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
    }
  }, []);

  // Auto scroll on load
  useEffect(() => {
    if (isMounted) {
      const timer = setTimeout(() => {
        jumpToToday();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isMounted, jumpToToday]);

  /**
   * Resolves the display team name (or bracket code for placeholder) for a match slot.
   *
   * For knockout matches: looks up the settled team from bracketView. If the slot
   * has a resolved team ID, returns the localised team name. Otherwise falls back
   * to the raw bracket code (e.g. "2A", "W73") which MatchCard renders as TBD.
   *
   * For group-stage matches: returns the raw name as-is (it's always a real team).
   */
  const resolveTeamLabel = (
    rawCode: string,
    num: number | undefined,
    slot: "team1" | "team2",
  ): string => {
    if (!num) return rawCode;

    const bracketId = NUM_TO_BRACKET_ID[num];
    if (!bracketId) return rawCode;

    const bracketMatch = bracketView[bracketId];
    if (!bracketMatch) return rawCode;

    const resolvedId =
      slot === "team1" ? bracketMatch.team1Id : bracketMatch.team2Id;
    if (!resolvedId) return rawCode;

    // Resolve team ID to locale-specific team name
    const team = getTeamById(resolvedId, locale);
    return team ? team.name : rawCode;
  };

  /**
   * Returns the status and score display for a match card.
   *
   * - No LiveResult → UPCOMING, no scores
   * - live → LIVE with current goals
   * - finished → FINISHED with final score (or penalty score if penalties exist)
   */
  const getMatchDisplay = (
    match: Match,
  ): {
    status: "LIVE" | "FINISHED" | "UPCOMING";
    score1?: string;
    score2?: string;
  } => {
    const num = match.num;
    if (!num) return { status: "UPCOMING" };

    const lr = liveByNum.get(num);
    if (!lr) return { status: "UPCOMING" };

    if (lr.status === "live") {
      return {
        status: "LIVE",
        score1: String(lr.goals1),
        score2: String(lr.goals2),
      };
    }

    // finished
    if (lr.penalties1 !== undefined && lr.penalties2 !== undefined) {
      // Show penalty score for knockout penalty shootout deciders
      return {
        status: "FINISHED",
        score1: String(lr.penalties1),
        score2: String(lr.penalties2),
      };
    }

    return {
      status: "FINISHED",
      score1: String(lr.goals1),
      score2: String(lr.goals2),
    };
  };

  if (!isMounted) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-2 text-mute dark:text-stone">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex items-start gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary mt-0.5">
          <CalendarDays className="size-6" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h1 className="text-heading-xl font-medium uppercase tracking-tight text-foreground">
            {tCalendar("title")}
          </h1>
          <p className="text-caption-md text-muted-foreground">
            {tCalendar("description")}
          </p>
          <div className="text-xs text-mute dark:text-stone mt-1 flex items-center gap-1.5 font-semibold">
            <Globe className="h-3.5 w-3.5 shrink-0" />
            <span>{tCalendar("timezoneNote", { tz: userTimezone })}</span>
          </div>
        </div>
      </header>

      {/* Sticky Controls Bar */}
      <div className="sticky top-14 z-40 flex flex-wrap items-center justify-between gap-4 border-b border-hairline bg-soft-cloud/95 py-4 backdrop-blur-md dark:border-ash dark:bg-ink/95">
        <div className="flex flex-wrap items-center gap-3">
          {/* Team Filter */}
          <div className="relative">
            <select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              className="appearance-none rounded-lg border border-hairline bg-canvas pl-4 pr-10 py-2 text-sm font-semibold text-ink dark:border-ash dark:bg-charcoal dark:text-canvas outline-none focus:border-ink dark:focus:border-canvas transition-colors"
            >
              <option value="">{tCalendar("allTeams")}</option>
              {allTeams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-mute dark:text-stone">
              <Filter className="h-3.5 w-3.5" />
            </div>
          </div>

          {/* Phase Filter */}
          <div className="relative">
            <select
              value={selectedPhase}
              onChange={(e) => setSelectedPhase(e.target.value)}
              className="appearance-none rounded-lg border border-hairline bg-canvas pl-4 pr-10 py-2 text-sm font-semibold text-ink dark:border-ash dark:bg-charcoal dark:text-canvas outline-none focus:border-ink dark:focus:border-canvas transition-colors"
            >
              <option value="">{tCalendar("allPhases")}</option>
              {phases.map((phase) => (
                <option key={phase} value={phase}>
                  {getPhaseTranslation(phase)}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-mute dark:text-stone">
              <Filter className="h-3.5 w-3.5" />
            </div>
          </div>
        </div>

        {/* Jump to Today Button */}
        <button
          type="button"
          onClick={jumpToToday}
          className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-canvas transition-all hover:opacity-90 dark:bg-canvas dark:text-ink shadow-sm cursor-pointer active:scale-95"
        >
          <CalendarDays className="h-4 w-4" />
          {tCalendar("jumpToToday")}
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="space-y-10">
        {phases.filter((phase) => groupedMatches[phase]).length === 0 ? (
          <div className="py-12 text-center text-mute dark:text-stone font-semibold">
            {tCalendar("noMatches")}
          </div>
        ) : (
          phases
            .filter((phase) => groupedMatches[phase])
            .map((phase) => (
              <div key={phase} className="space-y-6">
                {/* Phase Title */}
                <div className="flex items-center gap-2 border-b border-hairline pb-2 dark:border-ash">
                  <div className="h-4 w-1 bg-ink dark:bg-canvas rounded-full" />
                  <h2 className="font-display-campaign text-xl font-bold uppercase tracking-wider text-ink dark:text-canvas">
                    {getPhaseTranslation(phase)}
                  </h2>
                </div>

                {/* Days list */}
                <div className="space-y-8">
                  {Object.keys(groupedMatches[phase])
                    .sort((a, b) => a.localeCompare(b))
                    .map((date) => (
                      <div
                        key={date}
                        id={`day-${date}`}
                        className="space-y-3 scroll-mt-32"
                      >
                        {/* Day Title / Anchor Header */}
                        <h3 className="text-sm font-bold uppercase tracking-wide text-mute dark:text-stone">
                          {formatDate(date)}
                        </h3>

                        {/* Matches grid */}
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {groupedMatches[phase][date].map((match) => {
                            const { status, score1, score2 } =
                              getMatchDisplay(match);

                            const team1 = resolveTeamLabel(
                              match.team1,
                              match.num,
                              "team1",
                            );
                            const team2 = resolveTeamLabel(
                              match.team2,
                              match.num,
                              "team2",
                            );

                            return (
                              <MatchCard
                                key={
                                  match.num || `${match.team1}-${match.team2}`
                                }
                                round={match.round}
                                date={match.date}
                                time={match.time}
                                team1={team1}
                                team2={team2}
                                group={match.group}
                                ground={match.ground}
                                locale={locale}
                                status={status}
                                score1={score1}
                                score2={score2}
                              />
                            );
                          })}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))
        )}
      </div>
    </div>
  );
}
