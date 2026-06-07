"use client";

import { useLocale, useTranslations } from "next-intl";
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

const EMPTY_ACTUAL_RESULTS = {
  R32: new Set<string>(),
  R16: new Set<string>(),
  QF: new Set<string>(),
  SF: new Set<string>(),
  F: new Set<string>(),
  champion: null as string | null,
  thirdPlace: null as string | null,
};

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
  const t = useTranslations("score");
  const matchedTeams = teams.filter((team) => actualTeamIds.has(team.id));
  const totalPoints = matchedTeams.length * points;
  const noTeamsYet = t("noTeamsYet");
  const subtotal = t("subtotal");

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
            {matchedTeams.length}/{teams.length} {t("correct")}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-300">
            {points} {t("ptsPerTeam")}
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
          {noTeamsYet}
        </div>
      )}

      <div className="mt-3 flex items-center justify-end border-t border-slate-200 pt-2 dark:border-slate-700">
        <span className="text-sm font-bold text-slate-900 dark:text-white">
          {subtotal}{" "}
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
  const t = useTranslations("score");
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
            {t("notYetDetermined")}
          </span>
        </div>
      )}
      <div className="mt-2 text-right text-sm font-bold text-slate-900 dark:text-white">
        {t("subtotal")}{" "}
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
  const t = useTranslations("score");
  const locale = useLocale();
  const teamsLookup = getAllTeamsLookup(locale);
  const actualResults = EMPTY_ACTUAL_RESULTS;

  const r32Teams = getTeamsInRound(state, "R32", locale);
  const r16Teams = getTeamsInRound(state, "R16", locale);
  const qfTeams = getTeamsInRound(state, "QF", locale);
  const sfTeams = getTeamsInRound(state, "SF", locale);
  const finalTeams = getTeamsInRound(state, "F", locale);

  const finalMatch = state.knockoutMatches["F-1"];
  const thirdMatch = state.knockoutMatches["3RD-1"];
  const predictedChampion = finalMatch?.winnerId
    ? (teamsLookup.get(finalMatch.winnerId) ?? null)
    : null;
  const predictedThirdPlace = thirdMatch?.winnerId
    ? (teamsLookup.get(thirdMatch.winnerId) ?? null)
    : null;

  const r32Correct = r32Teams.filter((team) =>
    actualResults.R32.has(team.id),
  ).length;
  const r16Correct = r16Teams.filter((team) =>
    actualResults.R16.has(team.id),
  ).length;
  const qfCorrect = qfTeams.filter((team) =>
    actualResults.QF.has(team.id),
  ).length;
  const sfCorrect = sfTeams.filter((team) =>
    actualResults.SF.has(team.id),
  ).length;
  const finalCorrect = finalTeams.filter((team) =>
    actualResults.F.has(team.id),
  ).length;

  const r32Points = r32Correct * ROUND_POINTS.R32;
  const r16Points = r16Correct * ROUND_POINTS.R16;
  const qfPoints = qfCorrect * ROUND_POINTS.QF;
  const sfPoints = sfCorrect * ROUND_POINTS.SF;
  const finalPoints = finalCorrect * ROUND_POINTS.F;
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
          {t("totalScore")}
        </h2>
        <div className="text-5xl font-extrabold text-white">
          {totalPoints}
          <span className="ml-2 text-2xl font-medium text-slate-400">pts</span>
        </div>
      </div>

      <RoundCard
        title={t("roundOf32")}
        round="R32"
        points={ROUND_POINTS.R32}
        teams={r32Teams}
        actualTeamIds={actualResults.R32}
        accent="bg-cyan-500"
      />
      <RoundCard
        title={t("roundOf16")}
        round="R16"
        points={ROUND_POINTS.R16}
        teams={r16Teams}
        actualTeamIds={actualResults.R16}
        accent="bg-cyan-500"
      />

      <RoundCard
        title={t("quarterFinals")}
        round="QF"
        points={ROUND_POINTS.QF}
        teams={qfTeams}
        actualTeamIds={actualResults.QF}
        accent="bg-amber-500"
      />
      <RoundCard
        title={t("semiFinals")}
        round="SF"
        points={ROUND_POINTS.SF}
        teams={sfTeams}
        actualTeamIds={actualResults.SF}
        accent="bg-amber-500"
      />

      <RoundCard
        title={t("final")}
        round="F"
        points={ROUND_POINTS.F}
        teams={finalTeams}
        actualTeamIds={actualResults.F}
        accent="bg-emerald-500"
      />

      <div className="grid gap-4 md:grid-cols-2">
        <WinnerCard
          title={t("champion")}
          team={predictedChampion}
          actualWinnerId={actualResults.champion}
          points={CHAMPION_POINTS}
          accent="bg-amber-500"
          icon={trophyIcon}
        />
        <WinnerCard
          title={t("thirdPlace")}
          team={predictedThirdPlace}
          actualWinnerId={actualResults.thirdPlace}
          points={THIRD_PLACE_POINTS}
          accent="bg-rose-500"
          icon={medalIcon}
        />
      </div>

      <div className="rounded-xl bg-white/80 p-4 shadow-lg dark:bg-gradient-to-br dark:from-slate-800 dark:to-slate-900">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-900 dark:text-white">
          {t("pointsBreakdown")}
        </h3>
        <div className="space-y-2">
          {[
            {
              label: t("roundOf32Label", { count: r32Correct }),
              pts: r32Points,
            },
            {
              label: t("roundOf16Label", { count: r16Correct }),
              pts: r16Points,
            },
            {
              label: t("quarterFinalsLabel", { count: qfCorrect }),
              pts: qfPoints,
            },
            {
              label: t("semiFinalsLabel", { count: sfCorrect }),
              pts: sfPoints,
            },
            {
              label: t("finalLabel", { count: finalCorrect }),
              pts: finalPoints,
            },
            { label: t("thirdPlaceWinner"), pts: thirdPlacePoints },
            { label: t("championLabel"), pts: championPoints },
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
              {t("total")}
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
