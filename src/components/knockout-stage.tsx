"use client";

import type { Dispatch } from "react";
import {
  getAllTeamsLookup,
  KNOCKOUT_MATCH_IDS,
  type KnockoutRound,
  type TournamentAction,
  type TournamentState,
} from "@/lib/prediction-state";
import { cn } from "@/lib/utils";

interface Team {
  id: string;
  name: string;
  flag: string;
}

function EmptySlot() {
  return (
    <div className="flex items-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-100/50 px-2 py-1.5 dark:border-slate-600 dark:bg-slate-800/50">
      <div className="h-4 w-4 rounded-sm bg-slate-200 dark:bg-slate-700" />
      <span className="text-xs text-slate-400 dark:text-slate-500">TBD</span>
    </div>
  );
}

function MatchTeamRow({
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
  return (
    <button
      onClick={onSelect}
      disabled={!canSelect}
      type="button"
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-all",
        canSelect &&
          "cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-600/80",
        !canSelect && "cursor-default",
        isWinner && "bg-emerald-100 dark:bg-emerald-900/40",
        isLoser && "opacity-40 grayscale",
      )}
    >
      <span
        role="img"
        aria-label={`${team.name} flag`}
        className="shrink-0 text-sm leading-none"
      >
        {team.flag}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-xs font-bold tracking-tight",
          isWinner
            ? "text-emerald-700 dark:text-emerald-400"
            : "text-slate-900 dark:text-white",
        )}
      >
        {team.name}
      </span>
      {isWinner && (
        <svg
          aria-hidden="true"
          className="h-3 w-3 text-emerald-600 dark:text-emerald-400"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      )}
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
}: {
  matchNumber: number;
  matchId: string;
  team1: Team | null;
  team2: Team | null;
  winnerId: string | null;
  onSelectWinner: (teamId: string) => void;
}) {
  const canSelect = team1 !== null && team2 !== null;
  return (
    <div className="rounded-lg bg-white/90 p-2 shadow-md dark:bg-slate-800/90">
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
        Match {matchNumber}
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
}: {
  title: string;
  round: KnockoutRound;
  state: TournamentState;
  dispatch: Dispatch<TournamentAction>;
  accent?: keyof typeof accentColors;
}) {
  const teamsLookup = getAllTeamsLookup();
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
    matchCount >= 8
      ? "grid-cols-2 sm:grid-cols-4 lg:grid-cols-8"
      : matchCount >= 4
        ? "grid-cols-2 sm:grid-cols-4"
        : matchCount >= 2
          ? "grid-cols-2"
          : "grid-cols-1";

  return (
    <div className="rounded-xl bg-white/60 p-3 shadow-lg dark:bg-slate-800/40">
      <div className="mb-3 flex items-center gap-2">
        <div className={cn("h-4 w-1 rounded-full", accentColors[accent])} />
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-900 dark:text-white">
          {title}
        </h3>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          ({matchCount} {matchCount === 1 ? "match" : "matches"})
        </span>
      </div>
      <div className={cn("grid gap-2", gridCols)}>
        {matches.map((match) => (
          <MatchCard
            key={match.matchId}
            {...match}
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
}: {
  state: TournamentState;
  dispatch: Dispatch<TournamentAction>;
}) {
  return (
    <div className="space-y-4">
      <RoundSection
        title="Round of 32"
        round="R32"
        state={state}
        dispatch={dispatch}
        accent="cyan"
      />
      <RoundSection
        title="Round of 16"
        round="R16"
        state={state}
        dispatch={dispatch}
        accent="cyan"
      />
      <RoundSection
        title="Quarter Finals"
        round="QF"
        state={state}
        dispatch={dispatch}
        accent="amber"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <RoundSection
          title="Semi Finals"
          round="SF"
          state={state}
          dispatch={dispatch}
          accent="amber"
        />
        <RoundSection
          title="3rd Place Match"
          round="3RD"
          state={state}
          dispatch={dispatch}
          accent="rose"
        />
      </div>
      <RoundSection
        title="Final"
        round="F"
        state={state}
        dispatch={dispatch}
        accent="emerald"
      />
    </div>
  );
}
