"use client";

import {
  getAllTeamsLookup,
  getTeamsInRound,
  type KnockoutRound,
  type TournamentState,
} from "@/lib/prediction-state";
import { cn } from "@/lib/utils";

const ROUND_POINTS: Record<string, number> = {
  R32: 3,
  R16: 4,
  QF: 5,
  SF: 6,
  F: 8,
};
const THIRD_PLACE_POINTS = 5;
const CHAMPION_POINTS = 10;

function getSimulatedActualResults(_state: TournamentState) {
  const teamsLookup = getAllTeamsLookup();
  const allTeamIds = Array.from(teamsLookup.keys());
  const seed = 42;
  const shuffled = [...allTeamIds].sort((a, b) => {
    const hashA = a.split("").reduce((acc, c) => acc + c.charCodeAt(0), seed);
    const hashB = b.split("").reduce((acc, c) => acc + c.charCodeAt(0), seed);
    return hashA - hashB;
  });
  return {
    R32: new Set(shuffled.slice(0, 32)),
    R16: new Set(shuffled.slice(0, 16)),
    QF: new Set(shuffled.slice(0, 8)),
    SF: new Set(shuffled.slice(0, 4)),
    F: new Set(shuffled.slice(0, 2)),
    champion: shuffled[0],
    thirdPlace: shuffled[3],
  };
}

interface Team {
  id: string;
  name: string;
  flag: string;
}

function RoundCard({
  title,
  points,
  teams,
  actualTeamIds,
  accent,
}: {
  title: string;
  round: KnockoutRound;
  points: number;
  teams: Team[];
  actualTeamIds: Set<string>;
  accent: string;
}) {
  const matchedTeams = teams.filter((t) => actualTeamIds.has(t.id));
  const totalPoints = matchedTeams.length * points;

  return (
    <div className="rounded-xl bg-white/80 p-4 shadow-lg dark:bg-gradient-to-br dark:from-slate-800 dark:to-slate-900">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn("h-4 w-1 rounded-full", accent)} />
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900 dark:text-white">
            {title}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {matchedTeams.length}/{teams.length} correct
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-300">
            {points} pts/team
          </span>
        </div>
      </div>

      {teams.length > 0 ? (
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
          {teams.map((team) => {
            const isMatched = actualTeamIds.has(team.id);
            return (
              <div
                key={team.id}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5",
                  isMatched
                    ? "bg-emerald-100 dark:bg-emerald-900/40"
                    : "bg-slate-100 opacity-50 dark:bg-slate-700/30",
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
                    "min-w-0 flex-1 truncate text-xs font-bold",
                    isMatched
                      ? "text-emerald-800 dark:text-emerald-300"
                      : "text-slate-400 dark:text-slate-500",
                  )}
                >
                  {team.name}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-4 text-center text-sm text-slate-400 dark:text-slate-500">
          No teams yet — complete the knockout bracket
        </div>
      )}

      <div className="mt-3 flex items-center justify-end border-t border-slate-200 pt-2 dark:border-slate-700">
        <span className="text-sm font-bold text-slate-900 dark:text-white">
          Subtotal:{" "}
          <span
            className={cn(
              totalPoints > 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-slate-400",
            )}
          >
            {totalPoints} pts
          </span>
        </span>
      </div>
    </div>
  );
}

function WinnerCard({
  title,
  team,
  actualWinnerId,
  points,
  accent,
  icon,
}: {
  title: string;
  team: Team | null;
  actualWinnerId: string | null;
  points: number;
  accent: string;
  icon: React.ReactNode;
}) {
  const isMatched = team && actualWinnerId && team.id === actualWinnerId;
  const earnedPoints = isMatched ? points : 0;

  return (
    <div className="rounded-xl bg-white/80 p-4 shadow-lg dark:bg-gradient-to-br dark:from-slate-800 dark:to-slate-900">
      <div className="mb-3 flex items-center gap-2">
        <div className={cn("h-4 w-1 rounded-full", accent)} />
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900 dark:text-white">
          {title}
        </h3>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-300">
          {points} pts
        </span>
      </div>

      {team ? (
        <div
          className={cn(
            "flex items-center gap-3 rounded-lg p-3",
            isMatched
              ? "bg-emerald-100 dark:bg-emerald-900/40"
              : "bg-slate-100 opacity-60 dark:bg-slate-700/30",
          )}
        >
          {icon}
          <span
            role="img"
            aria-label={`${team.name} flag`}
            className="shrink-0 text-xl leading-none"
          >
            {team.flag}
          </span>
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-base font-bold",
              isMatched
                ? "text-emerald-800 dark:text-emerald-300"
                : "text-slate-400 dark:text-slate-500",
            )}
          >
            {team.name}
          </span>
          <span
            className={cn(
              "text-lg font-bold",
              isMatched
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-slate-300 dark:text-slate-600",
            )}
          >
            {isMatched ? `+${points}` : "+0"}
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 p-4 dark:border-slate-700">
          {icon}
          <span className="text-sm text-slate-400 dark:text-slate-500">
            Not yet determined
          </span>
        </div>
      )}
      <div className="mt-2 text-right text-sm font-bold text-slate-900 dark:text-white">
        Subtotal:{" "}
        <span
          className={cn(
            earnedPoints > 0
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-slate-400",
          )}
        >
          {earnedPoints} pts
        </span>
      </div>
    </div>
  );
}

export function ScoreTab({ state }: { state: TournamentState }) {
  const teamsLookup = getAllTeamsLookup();
  const actualResults = getSimulatedActualResults(state);

  const r32Teams = getTeamsInRound(state, "R32");
  const r16Teams = getTeamsInRound(state, "R16");
  const qfTeams = getTeamsInRound(state, "QF");
  const sfTeams = getTeamsInRound(state, "SF");
  const finalTeams = getTeamsInRound(state, "F");

  const finalMatch = state.knockoutMatches["F-1"];
  const thirdMatch = state.knockoutMatches["3RD-1"];
  const predictedChampion = finalMatch?.winnerId
    ? (teamsLookup.get(finalMatch.winnerId) ?? null)
    : null;
  const predictedThirdPlace = thirdMatch?.winnerId
    ? (teamsLookup.get(thirdMatch.winnerId) ?? null)
    : null;

  const r32Points =
    r32Teams.filter((t) => actualResults.R32.has(t.id)).length *
    ROUND_POINTS.R32;
  const r16Points =
    r16Teams.filter((t) => actualResults.R16.has(t.id)).length *
    ROUND_POINTS.R16;
  const qfPoints =
    qfTeams.filter((t) => actualResults.QF.has(t.id)).length * ROUND_POINTS.QF;
  const sfPoints =
    sfTeams.filter((t) => actualResults.SF.has(t.id)).length * ROUND_POINTS.SF;
  const finalPoints =
    finalTeams.filter((t) => actualResults.F.has(t.id)).length * ROUND_POINTS.F;
  const championPoints =
    predictedChampion?.id === actualResults.champion ? CHAMPION_POINTS : 0;
  const thirdPlacePoints =
    predictedThirdPlace?.id === actualResults.thirdPlace
      ? THIRD_PLACE_POINTS
      : 0;
  const totalPoints =
    r32Points +
    r16Points +
    qfPoints +
    sfPoints +
    finalPoints +
    championPoints +
    thirdPlacePoints;

  const trophyIcon = (
    <svg
      aria-hidden="true"
      className="h-6 w-6 text-amber-500"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M12 2C13.1 2 14 2.9 14 4V5H17C18.1 5 19 5.9 19 7V9C19 11.21 17.21 13 15 13H14.83C14.42 14.17 13.31 15 12 15C10.69 15 9.58 14.17 9.17 13H9C6.79 13 5 11.21 5 9V7C5 5.9 5.9 5 7 5H10V4C10 2.9 10.9 2 12 2ZM7 7V9C7 10.1 7.9 11 9 11V7H7ZM15 7V11C16.1 11 17 10.1 17 9V7H15ZM11 16V18H8V22H16V18H13V16H11Z" />
    </svg>
  );
  const medalIcon = (
    <svg
      aria-hidden="true"
      className="h-6 w-6 text-amber-600"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M12 2L9 6.5L4 6L5.5 11L2 14L6.5 16L6 21L12 18L18 21L17.5 16L22 14L18.5 11L20 6L15 6.5L12 2Z" />
    </svg>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-r from-slate-800 to-slate-900 p-6 text-center shadow-xl dark:from-slate-700 dark:to-slate-800">
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wider text-slate-400">
          Total Score
        </h2>
        <div className="text-5xl font-extrabold text-white">
          {totalPoints}
          <span className="ml-2 text-2xl font-medium text-slate-400">pts</span>
        </div>
      </div>

      <RoundCard
        title="Round of 32"
        round="R32"
        points={ROUND_POINTS.R32}
        teams={r32Teams}
        actualTeamIds={actualResults.R32}
        accent="bg-cyan-500"
      />
      <RoundCard
        title="Round of 16"
        round="R16"
        points={ROUND_POINTS.R16}
        teams={r16Teams}
        actualTeamIds={actualResults.R16}
        accent="bg-cyan-500"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <RoundCard
          title="Quarter Finals"
          round="QF"
          points={ROUND_POINTS.QF}
          teams={qfTeams}
          actualTeamIds={actualResults.QF}
          accent="bg-amber-500"
        />
        <RoundCard
          title="Semi Finals"
          round="SF"
          points={ROUND_POINTS.SF}
          teams={sfTeams}
          actualTeamIds={actualResults.SF}
          accent="bg-amber-500"
        />
      </div>

      <RoundCard
        title="Final"
        round="F"
        points={ROUND_POINTS.F}
        teams={finalTeams}
        actualTeamIds={actualResults.F}
        accent="bg-emerald-500"
      />

      <div className="grid gap-4 md:grid-cols-2">
        <WinnerCard
          title="Champion"
          team={predictedChampion}
          actualWinnerId={actualResults.champion}
          points={CHAMPION_POINTS}
          accent="bg-amber-500"
          icon={trophyIcon}
        />
        <WinnerCard
          title="3rd Place"
          team={predictedThirdPlace}
          actualWinnerId={actualResults.thirdPlace}
          points={THIRD_PLACE_POINTS}
          accent="bg-rose-500"
          icon={medalIcon}
        />
      </div>

      <div className="rounded-xl bg-white/80 p-4 shadow-lg dark:bg-gradient-to-br dark:from-slate-800 dark:to-slate-900">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-900 dark:text-white">
          Points Breakdown
        </h3>
        <div className="space-y-2">
          {[
            {
              label: `Round of 32 (${r32Teams.filter((t) => actualResults.R32.has(t.id)).length} correct × 3 pts)`,
              pts: r32Points,
            },
            {
              label: `Round of 16 (${r16Teams.filter((t) => actualResults.R16.has(t.id)).length} correct × 4 pts)`,
              pts: r16Points,
            },
            {
              label: `Quarter Finals (${qfTeams.filter((t) => actualResults.QF.has(t.id)).length} correct × 5 pts)`,
              pts: qfPoints,
            },
            {
              label: `Semi Finals (${sfTeams.filter((t) => actualResults.SF.has(t.id)).length} correct × 6 pts)`,
              pts: sfPoints,
            },
            {
              label: `Final (${finalTeams.filter((t) => actualResults.F.has(t.id)).length} correct × 8 pts)`,
              pts: finalPoints,
            },
            { label: "3rd Place Winner", pts: thirdPlacePoints },
            { label: "Champion", pts: championPoints },
          ].map(({ label, pts }) => (
            <div
              key={label}
              className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-700/50"
            >
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {label}
              </span>
              <span
                className={cn(
                  "font-bold",
                  pts > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-slate-400",
                )}
              >
                {pts}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between rounded-lg bg-gradient-to-r from-emerald-100 to-emerald-50 px-3 py-3 dark:from-emerald-900/50 dark:to-emerald-900/30">
            <span className="text-base font-bold text-emerald-800 dark:text-emerald-300">
              Total
            </span>
            <span className="text-xl font-extrabold text-emerald-700 dark:text-emerald-400">
              {totalPoints} pts
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
