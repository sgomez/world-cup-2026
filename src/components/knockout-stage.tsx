"use client";

import { useLocale, useTranslations } from "next-intl";
import type { Dispatch } from "react";
import { TeamBadge } from "@/components/team-badge";
import {
  getAllTeamsLookup,
  KNOCKOUT_MATCH_IDS,
  type KnockoutRound,
  type TournamentAction,
  type TournamentState,
} from "@/lib/prediction-state";
import type { Team } from "@/lib/teams";
import { cn } from "@/lib/utils";

function EmptySlot() {
  return (
    <div className="flex items-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-100/50 px-2 py-2.5 dark:border-slate-600 dark:bg-slate-800/50 sm:py-1.5">
      <div className="h-4 w-4 rounded-sm bg-slate-200 dark:bg-slate-700" />
      <span className="text-sm text-slate-400 dark:text-slate-500 sm:text-xs">
        TBD
      </span>
    </div>
  );
}

export function MatchTeamRow({
  team,
  isWinner,
  isLoser,
  canSelect,
  onSelect,
}: {
  team: Team | null;
  isWinner: boolean;
  isLoser: boolean;
  canSelect: boolean;
  onSelect: () => void;
}) {
  if (!team) return <EmptySlot />;

  const checkmark = isWinner ? (
    <div className="flex items-center justify-center shrink-0 z-20">
      <svg
        aria-hidden="true"
        className="h-4 w-4 text-success dark:text-success-bright"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
          clipRule="evenodd"
        />
      </svg>
    </div>
  ) : null;

  return (
    <button
      onClick={onSelect}
      disabled={!canSelect}
      type="button"
      className={cn(
        "relative block w-full text-left transition-all duration-200 focus:outline-none rounded-md",
        canSelect && "cursor-pointer hover:opacity-90 active:scale-[0.99]",
        !canSelect && "cursor-default",
      )}
    >
      <TeamBadge
        team={team}
        matched={isWinner}
        eliminated={isLoser}
        rightAddon={checkmark}
      />
    </button>
  );
}

function MatchCard({
  matchNumber,
  matchId: _matchId,
  team1,
  team2,
  winnerId,
  onSelectWinner,
  readOnly,
}: {
  matchNumber: number;
  matchId: string;
  team1: Team | null;
  team2: Team | null;
  winnerId: string | null;
  onSelectWinner: (teamId: string) => void;
  readOnly: boolean;
}) {
  const t = useTranslations("knockoutStage");
  const canSelect = team1 !== null && team2 !== null && !readOnly;
  return (
    <div className="rounded-lg bg-white/90 p-2 shadow-md dark:bg-slate-800/90">
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {t("match", { number: matchNumber })}
      </div>
      <div className="flex flex-col gap-0.5">
        <MatchTeamRow
          team={team1}
          isWinner={winnerId === team1?.id}
          isLoser={winnerId !== null && winnerId !== team1?.id}
          canSelect={canSelect}
          onSelect={() => team1 && onSelectWinner(team1.id)}
        />
        <MatchTeamRow
          team={team2}
          isWinner={winnerId === team2?.id}
          isLoser={winnerId !== null && winnerId !== team2?.id}
          canSelect={canSelect}
          onSelect={() => team2 && onSelectWinner(team2.id)}
        />
      </div>
    </div>
  );
}

const accentColors = {
  cyan: "bg-cyan-500",
  amber: "bg-amber-500",
  emerald: "bg-emerald-500",
  rose: "bg-rose-500",
};

function RoundSection({
  title,
  round,
  state,
  dispatch,
  accent = "cyan",
  readOnly = false,
}: {
  title: string;
  round: KnockoutRound;
  state: TournamentState;
  dispatch: Dispatch<TournamentAction>;
  accent?: keyof typeof accentColors;
  readOnly?: boolean;
}) {
  const t = useTranslations("knockoutStage");
  const locale = useLocale();
  const teamsLookup = getAllTeamsLookup(locale);
  const matchIds = KNOCKOUT_MATCH_IDS[round];
  const matchCount = matchIds.length;

  const matches = matchIds.map((matchId, i) => {
    const match = state.knockoutMatches[matchId];
    return {
      matchId,
      matchNumber: i + 1,
      team1: match?.team1Id ? (teamsLookup.get(match.team1Id) ?? null) : null,
      team2: match?.team2Id ? (teamsLookup.get(match.team2Id) ?? null) : null,
      winnerId: match?.winnerId ?? null,
    };
  });

  const handleSelectWinner = (matchId: string, teamId: string) => {
    const match = state.knockoutMatches[matchId];
    if (match?.winnerId === teamId) {
      dispatch({ type: "CLEAR_KNOCKOUT_WINNER", matchId });
    } else {
      dispatch({ type: "SET_KNOCKOUT_WINNER", matchId, winnerId: teamId });
    }
  };

  const gridCols =
    matchCount >= 4
      ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
      : matchCount >= 2
        ? "grid-cols-1 sm:grid-cols-2"
        : "grid-cols-1";

  return (
    <div className="rounded-xl bg-white/60 p-3 shadow-lg dark:bg-slate-800/40">
      <div className="mb-3 flex items-center gap-2">
        <div className={cn("h-4 w-1 rounded-full", accentColors[accent])} />
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-900 dark:text-white">
          {title}
        </h3>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          ({t("matchCount", { count: matchCount })})
        </span>
      </div>
      <div className={cn("grid gap-2", gridCols)}>
        {matches.map((match) => (
          <MatchCard
            key={match.matchId}
            {...match}
            readOnly={readOnly}
            onSelectWinner={(teamId) =>
              handleSelectWinner(match.matchId, teamId)
            }
          />
        ))}
      </div>
    </div>
  );
}

export function KnockoutStage({
  state,
  dispatch,
  readOnly = false,
}: {
  state: TournamentState;
  dispatch: Dispatch<TournamentAction>;
  readOnly?: boolean;
}) {
  const t = useTranslations("knockoutStage");
  return (
    <div className="space-y-4">
      <RoundSection
        title={t("roundOf32")}
        round="R32"
        state={state}
        dispatch={dispatch}
        accent="cyan"
        readOnly={readOnly}
      />
      <RoundSection
        title={t("roundOf16")}
        round="R16"
        state={state}
        dispatch={dispatch}
        accent="cyan"
        readOnly={readOnly}
      />
      <RoundSection
        title={t("quarterFinals")}
        round="QF"
        state={state}
        dispatch={dispatch}
        accent="amber"
        readOnly={readOnly}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <RoundSection
          title={t("semiFinals")}
          round="SF"
          state={state}
          dispatch={dispatch}
          accent="amber"
          readOnly={readOnly}
        />
        <RoundSection
          title={t("thirdPlaceMatch")}
          round="3RD"
          state={state}
          dispatch={dispatch}
          accent="rose"
          readOnly={readOnly}
        />
      </div>
      <RoundSection
        title={t("final")}
        round="F"
        state={state}
        dispatch={dispatch}
        accent="emerald"
        readOnly={readOnly}
      />
    </div>
  );
}
