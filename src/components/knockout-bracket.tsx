"use client";

import { useLocale, useTranslations } from "next-intl";
import type { Dispatch } from "react";
import { placeholderLabel } from "@/components/placeholder-label";
import { TeamBadge } from "@/components/team-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  KNOCKOUT_MATCH_IDS,
  type KnockoutMatch,
  type KnockoutRound,
  placeholderCodeForSlot,
  type TournamentState,
} from "@/modules/bracket";
import {
  getAllTeamsLookup,
  type TournamentAction,
} from "@/modules/bracket/prediction-ui";
import {
  type LiveMatchResult,
  matchScore,
  matchStatus,
} from "@/modules/schedule";
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
      bracketMatches: Record<string, KnockoutMatch>;
      liveResults?: LiveMatchResult[];
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
  rightAddon,
  placeholderLabelText,
}: {
  team: Team | null;
  isWinner: boolean;
  isLoser: boolean;
  canSelect: boolean;
  onSelect?: () => void;
  rightAddon?: React.ReactNode;
  placeholderLabelText?: string;
}) {
  if (!team) {
    if (placeholderLabelText) {
      return (
        <div className="flex items-center gap-2 rounded bg-soft-cloud/30 px-2 py-1.5 border border-dashed border-hairline/50 dark:bg-charcoal/30 dark:border-ash/50 h-8">
          <div className="h-4 w-4 shrink-0 rounded-sm bg-soft-cloud dark:bg-charcoal flex items-center justify-center text-[10px] font-bold text-mute/50">
            ?
          </div>
          <span className="text-[11px] font-[family-name:var(--font-oswald)] uppercase text-mute/60 dark:text-stone/60 truncate tracking-wide">
            {placeholderLabelText}
          </span>
        </div>
      );
    }
    return <EmptySlot />;
  }

  const checkmark =
    isWinner && canSelect ? (
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

  const rowContent = (
    <TeamBadge
      team={team}
      matched={isWinner}
      eliminated={isLoser}
      rightAddon={rightAddon ?? checkmark}
      border={false}
      size={!canSelect ? "compact" : "default"}
      showGrip={false}
    />
  );

  if (!onSelect) {
    return (
      <div
        className={cn(
          "relative block w-full text-left rounded-md cursor-default",
          isLoser && "opacity-45 grayscale",
        )}
      >
        {rowContent}
      </div>
    );
  }

  return (
    <Button
      onClick={onSelect}
      disabled={!canSelect}
      type="button"
      variant="ghost"
      className={cn(
        "relative block w-full text-left transition-all duration-200 focus:outline-none rounded-md h-auto p-0 hover:bg-transparent",
        "cursor-pointer hover:opacity-90 active:scale-[0.99]",
      )}
    >
      {rowContent}
    </Button>
  );
}

type MatchCardProps =
  | {
      mode: "editable";
      matchNumber: number;
      matchId: string;
      team1: Team | null;
      team2: Team | null;
      winnerId: string | null;
      onSelectWinner: (teamId: string) => void;
      readOnly: boolean;
    }
  | {
      mode: "scored";
      matchNumber: number;
      matchId: string;
      team1: Team | null;
      team2: Team | null;
      winnerId: string | null;
      liveResults: LiveMatchResult[];
    };

function MatchCard(props: MatchCardProps) {
  const t = useTranslations("knockoutStage");
  const tCalendar = useTranslations("calendar");

  if (props.mode === "editable") {
    const { matchNumber, team1, team2, winnerId, onSelectWinner, readOnly } =
      props;
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
  } else {
    const { matchNumber, matchId, team1, team2, winnerId, liveResults } = props;
    const scores = matchScore(matchNumber, liveResults);
    const status = matchStatus(matchNumber, liveResults);
    const finished = status === "finished";
    const live = status === "live";
    const upcoming = status === "upcoming" && team1 !== null && team2 !== null;

    const team1Code = team1 ? team1.id : placeholderCodeForSlot(matchId, 1);
    const team2Code = team2 ? team2.id : placeholderCodeForSlot(matchId, 2);

    const team1Label = team1
      ? team1.name
      : placeholderLabel(team1Code, tCalendar);
    const team2Label = team2
      ? team2.name
      : placeholderLabel(team2Code, tCalendar);

    const pen1 =
      scores?.penalties1 !== undefined ? `(${scores.penalties1})` : "";
    const pen2 =
      scores?.penalties2 !== undefined ? `(${scores.penalties2})` : "";

    const rightAddon1 =
      (finished || live) && scores ? (
        <div
          className={cn(
            "flex items-center gap-1 font-[family-name:var(--font-oswald)] text-xs font-bold shrink-0 pr-1",
            finished && winnerId === team1?.id
              ? "text-success dark:text-success-bright"
              : "text-ink dark:text-canvas",
          )}
        >
          <span>{scores.goals1}</span>
          {pen1 && (
            <span className="text-[10px] text-mute dark:text-stone font-semibold">
              {pen1}
            </span>
          )}
        </div>
      ) : null;

    const rightAddon2 =
      (finished || live) && scores ? (
        <div
          className={cn(
            "flex items-center gap-1 font-[family-name:var(--font-oswald)] text-xs font-bold shrink-0 pr-1",
            finished && winnerId === team2?.id
              ? "text-success dark:text-success-bright"
              : "text-ink dark:text-canvas",
          )}
        >
          <span>{scores.goals2}</span>
          {pen2 && (
            <span className="text-[10px] text-mute dark:text-stone font-semibold">
              {pen2}
            </span>
          )}
        </div>
      ) : null;

    return (
      <div className="rounded-lg bg-canvas p-3 border border-hairline shadow-sm dark:border-ash dark:bg-ink flex flex-col justify-between">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-mute dark:text-stone border-b border-hairline/25 pb-1 dark:border-ash/25 flex items-center justify-between">
          <span>{t("match", { number: matchNumber })}</span>
          {finished ? (
            <span className="text-mute/70 dark:text-stone/70 font-semibold">
              {tCalendar("finished")}
            </span>
          ) : live ? (
            <span className="text-sale font-bold animate-pulse flex items-center gap-1">
              <span className="h-1 w-1 rounded-full bg-sale" />
              {tCalendar("live")}
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
          <MatchTeamRow
            team={team1}
            isWinner={finished && winnerId === team1?.id}
            isLoser={finished && winnerId !== null && winnerId !== team1?.id}
            canSelect={false}
            rightAddon={rightAddon1}
            placeholderLabelText={team1Label}
          />
          <MatchTeamRow
            team={team2}
            isWinner={finished && winnerId === team2?.id}
            isLoser={finished && winnerId !== null && winnerId !== team2?.id}
            canSelect={false}
            rightAddon={rightAddon2}
            placeholderLabelText={team2Label}
          />
        </div>
      </div>
    );
  }
}

function RoundSection({
  round,
  teamsLookup,
  modeProps,
}: {
  round: KnockoutRound;
  teamsLookup: Map<string, Team>;
  modeProps:
    | {
        mode: "editable";
        state: TournamentState;
        dispatch: Dispatch<TournamentAction>;
        readOnly: boolean;
      }
    | {
        mode: "scored";
        bracketMatches: Record<string, KnockoutMatch>;
        liveResults: LiveMatchResult[];
      };
}) {
  const t = useTranslations("knockoutStage");
  const metadata = ROUND_METADATA[round];
  const matchIds = KNOCKOUT_MATCH_IDS[round];
  const matchCount = matchIds.length;

  const matches = matchIds.map((matchId, i) => {
    if (modeProps.mode === "editable") {
      const match = modeProps.state.knockoutMatches[matchId];
      return {
        matchId,
        matchNumber: i + 1,
        team1: match?.team1Id ? (teamsLookup.get(match.team1Id) ?? null) : null,
        team2: match?.team2Id ? (teamsLookup.get(match.team2Id) ?? null) : null,
        winnerId: match?.winnerId ?? null,
      };
    } else {
      const match = modeProps.bracketMatches[matchId];
      const matchNumber = matchId.includes("-")
        ? parseInt(matchId.split("-")[1], 10)
        : matchId === "F"
          ? 104
          : 103;
      return {
        matchId,
        matchNumber,
        team1: match?.team1Id ? (teamsLookup.get(match.team1Id) ?? null) : null,
        team2: match?.team2Id ? (teamsLookup.get(match.team2Id) ?? null) : null,
        winnerId: match?.winnerId ?? null,
      };
    }
  });

  const handleSelectWinner = (matchId: string, teamId: string) => {
    if (modeProps.mode !== "editable") return;
    const match = modeProps.state.knockoutMatches[matchId];
    if (match?.winnerId === teamId) {
      modeProps.dispatch({ type: "CLEAR_KNOCKOUT_WINNER", matchId });
    } else {
      modeProps.dispatch({
        type: "SET_KNOCKOUT_WINNER",
        matchId,
        winnerId: teamId,
      });
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
        {matches.map((match) => {
          if (modeProps.mode === "editable") {
            return (
              <MatchCard
                key={match.matchId}
                mode="editable"
                matchId={match.matchId}
                matchNumber={match.matchNumber}
                team1={match.team1}
                team2={match.team2}
                winnerId={match.winnerId}
                readOnly={modeProps.readOnly}
                onSelectWinner={(teamId) =>
                  handleSelectWinner(match.matchId, teamId)
                }
              />
            );
          } else {
            return (
              <MatchCard
                key={match.matchId}
                mode="scored"
                matchId={match.matchId}
                matchNumber={match.matchNumber}
                team1={match.team1}
                team2={match.team2}
                winnerId={match.winnerId}
                liveResults={modeProps.liveResults}
              />
            );
          }
        })}
      </div>
    </div>
  );
}

export function KnockoutBracket(props: KnockoutBracketProps) {
  const locale = useLocale();
  const teamsLookup = getAllTeamsLookup(locale);

  const modeProps =
    props.mode === "editable"
      ? {
          mode: "editable" as const,
          state: props.state,
          dispatch: props.dispatch,
          readOnly: props.readOnly ?? false,
        }
      : {
          mode: "scored" as const,
          bracketMatches: props.bracketMatches,
          liveResults: props.liveResults ?? [],
        };

  return (
    <div className="space-y-4">
      {(["R32", "R16", "QF"] as const).map((round) => (
        <RoundSection
          key={round}
          round={round}
          teamsLookup={teamsLookup}
          modeProps={modeProps}
        />
      ))}
      <div className="grid gap-4 sm:grid-cols-2">
        {(["SF", "3RD"] as const).map((round) => (
          <RoundSection
            key={round}
            round={round}
            teamsLookup={teamsLookup}
            modeProps={modeProps}
          />
        ))}
      </div>
      <RoundSection round="F" teamsLookup={teamsLookup} modeProps={modeProps} />
    </div>
  );
}
