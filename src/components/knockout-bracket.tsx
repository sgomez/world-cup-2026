"use client";

import { useLocale, useTranslations } from "next-intl";
import type { Dispatch } from "react";
import { TeamBadge } from "@/components/team-badge";
import { cn } from "@/lib/utils";
import {
  KNOCKOUT_MATCH_IDS,
  type KnockoutRound,
  type TournamentState,
} from "@/modules/bracket";
import {
  getAllTeamsLookup,
  type TournamentAction,
} from "@/modules/bracket/prediction-ui";
import type { Team } from "@/modules/teams";

type KnockoutBracketProps =
  | {
      mode: "editable";
      state: TournamentState;
      dispatch: Dispatch<TournamentAction>;
      readOnly?: boolean;
    }
  | {
      mode: "scored";
      // scored mode props will be defined and implemented in a follow-up issue
      state?: unknown;
    };

type RoundMetadata = {
  titleKey: string;
  accentToken: "cyan" | "amber" | "rose" | "emerald";
  gridCols: string;
};

const ROUND_METADATA: Record<KnockoutRound, RoundMetadata> = {
  R32: {
    titleKey: "roundOf32",
    accentToken: "cyan",
    gridCols: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  },
  R16: {
    titleKey: "roundOf16",
    accentToken: "cyan",
    gridCols: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  },
  QF: {
    titleKey: "quarterFinals",
    accentToken: "amber",
    gridCols: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  },
  SF: {
    titleKey: "semiFinals",
    accentToken: "amber",
    gridCols: "grid-cols-1 sm:grid-cols-2",
  },
  "3RD": {
    titleKey: "thirdPlaceMatch",
    accentToken: "rose",
    gridCols: "grid-cols-1",
  },
  F: {
    titleKey: "final",
    accentToken: "emerald",
    gridCols: "grid-cols-1",
  },
};

const accentTokenClasses = {
  cyan: "bg-accent-teal",
  amber: "bg-accent-purple-soft",
  rose: "bg-sale",
  emerald: "bg-success",
};

function EmptySlot() {
  return (
    <div className="flex items-center gap-2 rounded-md border border-dashed border-hairline bg-soft-cloud/50 px-2 py-2.5 dark:border-ash dark:bg-ink/50 sm:py-1.5">
      <div className="h-4 w-4 rounded-sm bg-hairline dark:bg-charcoal" />
      <span className="text-sm text-mute dark:text-stone sm:text-xs">TBD</span>
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
        border={false}
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
    <div className="rounded-lg bg-canvas/90 p-2 shadow-md dark:bg-ink/90">
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-mute dark:text-stone">
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

function RoundSection({
  round,
  state,
  dispatch,
  readOnly = false,
  teamsLookup,
}: {
  round: KnockoutRound;
  state: TournamentState;
  dispatch: Dispatch<TournamentAction>;
  readOnly?: boolean;
  teamsLookup: Map<string, Team>;
}) {
  const t = useTranslations("knockoutStage");
  const metadata = ROUND_METADATA[round];
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

  return (
    <div className="rounded-xl bg-canvas/60 p-3 shadow-lg dark:bg-ink/40">
      <div className="mb-3 flex items-center gap-2">
        <div
          className={cn(
            "h-4 w-1 rounded-full",
            accentTokenClasses[metadata.accentToken],
          )}
        />
        <h3 className="text-xs font-bold uppercase tracking-wide text-ink dark:text-canvas">
          {t(metadata.titleKey)}
        </h3>
        <span className="text-xs text-mute dark:text-stone">
          ({t("matchCount", { count: matchCount })})
        </span>
      </div>
      <div className={cn("grid gap-2", metadata.gridCols)}>
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

export function KnockoutBracket(props: KnockoutBracketProps) {
  const locale = useLocale();

  if (props.mode === "scored") {
    // Scored mode will be implemented in a follow-up issue,
    // currently we only render a placeholder or minimal read-only structure
    return null;
  }

  const { state, dispatch, readOnly = false } = props;
  const teamsLookup = getAllTeamsLookup(locale);

  return (
    <div className="space-y-4">
      {(["R32", "R16", "QF"] as const).map((round) => (
        <RoundSection
          key={round}
          round={round}
          state={state}
          dispatch={dispatch}
          readOnly={readOnly}
          teamsLookup={teamsLookup}
        />
      ))}
      <div className="grid gap-4 sm:grid-cols-2">
        {(["SF", "3RD"] as const).map((round) => (
          <RoundSection
            key={round}
            round={round}
            state={state}
            dispatch={dispatch}
            readOnly={readOnly}
            teamsLookup={teamsLookup}
          />
        ))}
      </div>
      <RoundSection
        round="F"
        state={state}
        dispatch={dispatch}
        readOnly={readOnly}
        teamsLookup={teamsLookup}
      />
    </div>
  );
}
