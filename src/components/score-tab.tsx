"use client";

import { useLocale, useTranslations } from "next-intl";
import { TeamBadge } from "@/components/team-badge";
import { cn } from "@/lib/utils";
import { getAllTeamsLookup } from "@/modules/bracket/prediction-ui";
import {
  CHAMPION_POINTS,
  EMPTY_SCOREABLE_CONTENT_ARRAYS,
  ROUND_POINTS,
  type ScoreableContentArrays,
  scoreBreakdown,
  THIRD_PLACE_POINTS,
  toScoreableContent,
} from "@/modules/score";
import type { Team } from "@/modules/teams";

function ScoreTeamChip({
  team,
  isMatched,
}: {
  team: Team;
  isMatched: boolean;
}) {
  return (
    <TeamBadge
      team={team}
      matched={isMatched}
      eliminated={!isMatched}
      size="compact"
      border={false}
    />
  );
}

function RoundCard({
  title,
  points,
  teams,
  actualTeamIds,
  accent,
}: {
  title: string;
  points: number;
  teams: Team[];
  actualTeamIds: Set<string>;
  accent: string;
}) {
  const t = useTranslations("score");
  const matchedTeams = teams.filter((team) =>
    actualTeamIds.has(team.id.toUpperCase()),
  );
  const totalPoints = matchedTeams.length * points;
  const noTeamsYet = t("noTeamsYet");
  const subtotal = t("subtotal");

  return (
    <div className="rounded-xl bg-canvas/80 p-4 shadow-lg dark:bg-gradient-to-br dark:from-charcoal/80 dark:to-ink/80">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn("h-4 w-1 rounded-full", accent)} />
          <h3 className="text-sm font-bold uppercase tracking-wide text-ink dark:text-canvas">
            {title}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-mute dark:text-stone">
            {matchedTeams.length}/{teams.length} {t("correct")}
          </span>
          <span className="rounded-full bg-soft-cloud px-2 py-0.5 text-xs font-bold text-charcoal dark:bg-charcoal dark:text-stone">
            {points} {t("ptsPerTeam")}
          </span>
        </div>
      </div>

      {teams.length > 0 ? (
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
          {teams.map((team) => {
            const isMatched = actualTeamIds.has(team.id.toUpperCase());
            return (
              <ScoreTeamChip key={team.id} team={team} isMatched={isMatched} />
            );
          })}
        </div>
      ) : (
        <div className="py-4 text-center text-sm text-stone dark:text-mute">
          {noTeamsYet}
        </div>
      )}

      <div className="mt-3 flex items-center justify-end border-t border-hairline pt-2 dark:border-ash">
        <span className="text-sm font-bold text-ink dark:text-canvas">
          {subtotal}{" "}
          <span
            className={cn(
              totalPoints > 0
                ? "text-success dark:text-success-bright"
                : "text-mute",
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
  const isMatched =
    team !== null &&
    actualWinnerId !== null &&
    team.id.toUpperCase() === actualWinnerId.toUpperCase();
  const earnedPoints = isMatched ? points : 0;

  return (
    <div className="rounded-xl bg-canvas/80 p-4 shadow-lg dark:bg-gradient-to-br dark:from-charcoal/80 dark:to-ink/80">
      <div className="mb-3 flex items-center gap-2">
        <div className={cn("h-4 w-1 rounded-full", accent)} />
        <h3 className="text-sm font-bold uppercase tracking-wide text-ink dark:text-canvas">
          {title}
        </h3>
        <span className="rounded-full bg-soft-cloud px-2 py-0.5 text-xs font-bold text-charcoal dark:bg-charcoal dark:text-stone">
          {points} pts
        </span>
      </div>

      {team ? (
        <div className="flex items-center gap-3">
          {icon}
          <div className="flex-1 min-w-0">
            <TeamBadge
              team={team}
              matched={isMatched}
              eliminated={!isMatched}
              border={false}
            />
          </div>
          <span
            className={cn(
              "text-lg font-bold shrink-0",
              isMatched
                ? "text-success dark:text-success-bright"
                : "text-hairline dark:text-ash",
            )}
          >
            {isMatched ? `+${points}` : "+0"}
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-hairline p-4 dark:border-ash">
          {icon}
          <span className="text-sm text-stone dark:text-mute">
            {t("notYetDetermined")}
          </span>
        </div>
      )}
      <div className="mt-2 text-right text-sm font-bold text-ink dark:text-canvas">
        {t("subtotal")}{" "}
        <span
          className={cn(
            earnedPoints > 0
              ? "text-success dark:text-success-bright"
              : "text-mute",
          )}
        >
          {earnedPoints} pts
        </span>
      </div>
    </div>
  );
}

export function ScoreTab({
  prediction,
  actualResults: actualResultsProp = EMPTY_SCOREABLE_CONTENT_ARRAYS,
  hasLiveMatch = false,
}: {
  prediction: ScoreableContentArrays;
  actualResults?: ScoreableContentArrays;
  hasLiveMatch?: boolean;
}) {
  const t = useTranslations("score");
  const locale = useLocale();
  const teamsLookup = getAllTeamsLookup(locale);
  const actualResults = toScoreableContent(actualResultsProp);

  const mapIdsToTeams = (ids: string[]) =>
    ids
      .map((id) => teamsLookup.get(id.toLowerCase()))
      .filter((t): t is Team => t !== undefined)
      .sort((a, b) => a.name.localeCompare(b.name, locale));

  const r32Teams = mapIdsToTeams(prediction.R32);
  const r16Teams = mapIdsToTeams(prediction.R16);
  const qfTeams = mapIdsToTeams(prediction.QF);
  const sfTeams = mapIdsToTeams(prediction.SF);
  const finalTeams = mapIdsToTeams(prediction.F);

  const predictedChampion = prediction.champion
    ? (teamsLookup.get(prediction.champion.toLowerCase()) ?? null)
    : null;
  const predictedThirdPlace = prediction.thirdPlace
    ? (teamsLookup.get(prediction.thirdPlace.toLowerCase()) ?? null)
    : null;

  const betContent = toScoreableContent(prediction);
  const breakdown = scoreBreakdown(betContent, actualResults);
  const totalPoints = breakdown.total;

  const r32Correct = breakdown.R32.matched;
  const r32Points = breakdown.R32.points;
  const r16Correct = breakdown.R16.matched;
  const r16Points = breakdown.R16.points;
  const qfCorrect = breakdown.QF.matched;
  const qfPoints = breakdown.QF.points;
  const sfCorrect = breakdown.SF.matched;
  const sfPoints = breakdown.SF.points;
  const finalCorrect = breakdown.F.matched;
  const finalPoints = breakdown.F.points;
  const championPoints = breakdown.champion.points;
  const thirdPlacePoints = breakdown.thirdPlace.points;

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
    <span
      className="flex h-6 w-6 items-center justify-center text-xl select-none"
      aria-hidden="true"
    >
      🥉
    </span>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-r from-charcoal to-ink p-6 text-center shadow-xl dark:from-ash dark:to-charcoal">
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wider text-stone">
          {t("totalScore")}
        </h2>
        <div className="text-5xl font-extrabold text-canvas">
          {totalPoints}
          <span className="ml-2 text-2xl font-medium text-stone">pts</span>
        </div>
      </div>

      {hasLiveMatch && (
        <div className="rounded-xl border border-sale/30 bg-sale/5 p-4 text-center text-caption-md font-medium text-sale dark:border-sale-deep/30">
          {t("provisionalNote")}
        </div>
      )}

      <RoundCard
        title={t("roundOf32")}
        points={ROUND_POINTS.R32}
        teams={r32Teams}
        actualTeamIds={actualResults.R32}
        accent="bg-early-rounds"
      />
      <RoundCard
        title={t("roundOf16")}
        points={ROUND_POINTS.R16}
        teams={r16Teams}
        actualTeamIds={actualResults.R16}
        accent="bg-early-rounds"
      />

      <RoundCard
        title={t("quarterFinals")}
        points={ROUND_POINTS.QF}
        teams={qfTeams}
        actualTeamIds={actualResults.QF}
        accent="bg-late-rounds"
      />
      <RoundCard
        title={t("semiFinals")}
        points={ROUND_POINTS.SF}
        teams={sfTeams}
        actualTeamIds={actualResults.SF}
        accent="bg-late-rounds"
      />

      <RoundCard
        title={t("final")}
        points={ROUND_POINTS.F}
        teams={finalTeams}
        actualTeamIds={actualResults.F}
        accent="bg-final"
      />

      <div className="grid gap-4 md:grid-cols-2">
        <WinnerCard
          title={t("champion")}
          team={predictedChampion}
          actualWinnerId={actualResults.champion}
          points={CHAMPION_POINTS}
          accent="bg-late-rounds"
          icon={trophyIcon}
        />
        <WinnerCard
          title={t("thirdPlace")}
          team={predictedThirdPlace}
          actualWinnerId={actualResults.thirdPlace}
          points={THIRD_PLACE_POINTS}
          accent="bg-third-place"
          icon={medalIcon}
        />
      </div>

      <div className="rounded-xl bg-canvas/80 p-4 shadow-lg dark:bg-gradient-to-br dark:from-charcoal/80 dark:to-ink/80">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink dark:text-canvas">
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
              className="flex items-center justify-between rounded-lg bg-soft-cloud px-3 py-2 dark:bg-charcoal/50"
            >
              <span className="text-sm text-charcoal dark:text-stone">
                {label}
              </span>
              <span
                className={cn(
                  "font-bold",
                  pts > 0
                    ? "text-success dark:text-success-bright"
                    : "text-mute",
                )}
              >
                {pts}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between rounded-lg bg-gradient-to-r from-success/15 to-success/5 px-3 py-3 dark:from-success-bright/20 dark:to-success-bright/10">
            <span className="text-base font-bold text-success dark:text-success-bright">
              {t("total")}
            </span>
            <span className="text-xl font-extrabold text-success dark:text-success-bright">
              {totalPoints} pts
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
