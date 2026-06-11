"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import {
  setGroupTieBreakFactorAction,
  setThirdsTieBreakFactorAction,
} from "@/app/actions/tournament";
import { TeamBadge } from "@/components/team-badge";
import { useToast } from "@/components/ui/toast";
import type { Match } from "@/lib/matches";
import { getTeamById, getTeamByName } from "@/lib/teams";
import { cn } from "@/lib/utils";
import type { LiveResultState } from "@/modules/live/domain/live-result";
import type { GroupTieInfo } from "@/modules/tournament/domain/derive-result";

function getTeamId(name: string): string {
  return getTeamByName(name, "en")?.id || name.toLowerCase();
}

/**
 * Computes group stage stats (played, pts, gf, ga, gd) for a team.
 */
function computeTeamStats(
  teamId: string,
  groupLetter: string,
  matches: Match[],
  liveResults: LiveResultState[],
) {
  const groupMatches = matches.filter(
    (m) => m.group === `Group ${groupLetter}`,
  );
  let pts = 0;
  let gf = 0;
  let ga = 0;
  let played = 0;

  for (const m of groupMatches) {
    const lr = liveResults.find((r) => r.num === m.num);
    if (lr && lr.status !== "upcoming") {
      const t1 = getTeamId(m.team1);
      const t2 = getTeamId(m.team2);
      const isT1 = t1 === teamId;
      const isT2 = t2 === teamId;
      if (isT1 || isT2) {
        played++;
        const goalsSelf = isT1 ? lr.goals1 : lr.goals2;
        const goalsOpp = isT1 ? lr.goals2 : lr.goals1;
        gf += goalsSelf;
        ga += goalsOpp;
        if (goalsSelf > goalsOpp) pts += 3;
        else if (goalsSelf === goalsOpp) pts += 1;
      }
    }
  }
  return { pts, gf, ga, gd: gf - ga, played };
}

/**
 * Compact input component for editing tie-break factors.
 */
function FactorInput({
  initialValue,
  onSave,
}: {
  initialValue: number | string;
  onSave: (val: number) => Promise<void>;
}) {
  const [value, setValue] = useState<string>(
    initialValue && initialValue !== "0" && initialValue !== 0
      ? initialValue.toString()
      : "",
  );
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setValue(
      initialValue && initialValue !== "0" && initialValue !== 0
        ? initialValue.toString()
        : "",
    );
  }, [initialValue]);

  const handleBlur = () => {
    triggerSave();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    }
  };

  const triggerSave = () => {
    const numeric = parseInt(value, 10);
    const parsed = Number.isNaN(numeric) || numeric < 0 ? 0 : numeric;
    const currentParsed = parseInt(initialValue.toString(), 10) || 0;
    if (parsed !== currentParsed) {
      startTransition(async () => {
        try {
          await onSave(parsed);
        } catch {
          setValue(
            initialValue && initialValue !== "0" && initialValue !== 0
              ? initialValue.toString()
              : "",
          );
        }
      });
    } else {
      setValue(parsed === 0 ? "" : parsed.toString());
    }
  };

  return (
    <input
      type="number"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      disabled={isPending}
      min="0"
      className={cn(
        "w-14 h-8 text-center rounded border border-hairline bg-canvas text-ink dark:border-ash dark:bg-ink dark:text-canvas text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-info focus:border-info transition-opacity",
        isPending && "opacity-60",
      )}
    />
  );
}

export type AdminTieBreakPanelProps = {
  matches: Match[];
  liveResults: LiveResultState[];
  groupTieInfo: Record<string, GroupTieInfo>;
  thirdsTieClusters: string[][];
  thirdsStanding: string[];
  manualTieBreaks: Record<string, Record<string, number>>;
  thirdPlaceManualOrder: Record<string, number> | null;
  locale: string;
};

export function AdminTieBreakPanel({
  matches,
  liveResults,
  groupTieInfo,
  thirdsTieClusters,
  manualTieBreaks,
  thirdPlaceManualOrder,
  locale,
}: AdminTieBreakPanelProps) {
  const t = useTranslations("adminTieBreak");
  const tTournament = useTranslations("tournament");
  const tGroupStage = useTranslations("groupStage");
  const { toast } = useToast();

  const groups = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

  // Sort groups alphabetically
  const sortedGroupLetters = [...groups].sort((a, b) => a.localeCompare(b));

  const handleSaveGroupFactor = async (
    groupLetter: string,
    teamId: string,
    val: number,
  ) => {
    const result = await setGroupTieBreakFactorAction(groupLetter, teamId, val);
    if (result?.error) {
      toast(result.error, "error");
      throw new Error(result.error);
    } else {
      toast(t("savedSuccess"), "success");
    }
  };

  const handleSaveThirdsFactor = async (teamId: string, val: number) => {
    const result = await setThirdsTieBreakFactorAction(teamId, val);
    if (result?.error) {
      toast(result.error, "error");
      throw new Error(result.error);
    } else {
      toast(t("savedSuccess"), "success");
    }
  };

  // Compile thirds stats and sort them in their derived order
  const thirdsList = Object.entries(groupTieInfo)
    .map(([groupLetter, info]) => {
      const teamId = info.standing[2];
      if (!teamId) return null;
      const stats = computeTeamStats(teamId, groupLetter, matches, liveResults);
      const factor = thirdPlaceManualOrder?.[teamId] ?? 0;
      return { teamId, groupLetter, ...stats, factor };
    })
    .filter((t): t is NonNullable<typeof t> => t !== null);

  thirdsList.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    if (b.factor !== a.factor) return b.factor - a.factor;
    return a.groupLetter.localeCompare(b.groupLetter);
  });

  return (
    <div className="space-y-6">
      <p className="text-caption-md text-mute dark:text-stone">
        {t("description")}
      </p>

      {/* Grid of Group Standings */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {sortedGroupLetters.map((groupLetter) => {
          const info = groupTieInfo[groupLetter];
          if (!info) return null;

          return (
            <div
              key={groupLetter}
              className="rounded-xl border border-hairline bg-canvas p-4 shadow-sm dark:border-ash dark:bg-ink flex flex-col justify-between"
            >
              <div>
                {/* Group Header */}
                <div className="mb-3 flex items-center justify-between gap-2 border-b border-hairline pb-2 dark:border-ash">
                  <span className="font-display-campaign text-sm font-bold uppercase tracking-wider text-ink dark:text-canvas">
                    {t("groupTieBreak", { group: groupLetter })}
                  </span>
                </div>

                {/* Group Standings Table */}
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="text-[10px] font-bold uppercase tracking-wider text-mute dark:text-stone border-b border-hairline/30 dark:border-ash/30">
                      <th className="py-1 px-1 text-left w-6">
                        {tTournament("pos")}
                      </th>
                      <th className="py-1 px-2 text-left">
                        {tTournament("team")}
                      </th>
                      <th className="py-1 px-1 text-center w-8">
                        {tTournament("pts")}
                      </th>
                      <th className="py-1 px-1 text-center w-6">
                        {tTournament("gf")}
                      </th>
                      <th className="py-1 px-1 text-center w-6">
                        {tTournament("ga")}
                      </th>
                      <th className="py-1 px-1 text-center w-6">
                        {tTournament("gd")}
                      </th>
                      <th className="py-1 px-1 text-center w-14">
                        {t("factor")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline/10 dark:divide-ash/10 select-none">
                    {info.standing.map((teamId, index) => {
                      const team = getTeamById(teamId, locale);
                      if (!team) return null;

                      const stats = computeTeamStats(
                        teamId,
                        groupLetter,
                        matches,
                        liveResults,
                      );
                      const factor =
                        manualTieBreaks[groupLetter]?.[teamId] ?? 0;
                      const isTied = info.tieClusters.some((cluster) =>
                        cluster.includes(teamId),
                      );
                      const gdSign = stats.gd > 0 ? `+${stats.gd}` : stats.gd;

                      return (
                        <tr
                          key={teamId}
                          className={cn(
                            "text-xs font-semibold transition-colors duration-200 border-l-2",
                            isTied
                              ? "bg-amber-500/5 dark:bg-amber-500/10 border-l-amber-500"
                              : "border-l-transparent",
                          )}
                        >
                          <td className="py-1.5 px-1 font-[family-name:var(--font-oswald)] text-[10px] text-mute dark:text-stone text-left">
                            {index + 1}
                          </td>
                          <td className="py-1.5 px-2 text-left">
                            <TeamBadge
                              team={team}
                              size="compact"
                              border={false}
                              showGrip={false}
                            />
                          </td>
                          <td className="py-1.5 px-1 text-center font-bold text-ink dark:text-canvas">
                            {stats.pts}
                          </td>
                          <td className="py-1.5 px-1 text-center font-normal text-[10px] text-mute dark:text-stone">
                            {stats.gf}
                          </td>
                          <td className="py-1.5 px-1 text-center font-normal text-[10px] text-mute dark:text-stone">
                            {stats.ga}
                          </td>
                          <td className="py-1.5 px-1 text-center font-bold text-[10px] text-mute dark:text-stone">
                            {gdSign}
                          </td>
                          <td className="py-1.5 px-1 text-center">
                            <FactorInput
                              initialValue={factor}
                              onSave={(val) =>
                                handleSaveGroupFactor(groupLetter, teamId, val)
                              }
                            />
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

      {/* Best Thirds Section */}
      <div className="rounded-xl border border-hairline bg-canvas p-4 shadow-sm dark:border-ash dark:bg-ink">
        <div className="mb-3 flex items-center justify-between gap-2 border-b border-hairline pb-2 dark:border-ash">
          <span className="font-display-campaign text-sm font-bold uppercase tracking-wider text-ink dark:text-canvas">
            {t("thirdsTieBreak")}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-[10px] font-bold uppercase tracking-wider text-mute dark:text-stone border-b border-hairline/30 dark:border-ash/30">
                <th className="py-1 px-1 text-left w-10">
                  {tTournament("pos")}
                </th>
                <th className="py-1 px-2 text-left">{tTournament("team")}</th>
                <th className="py-1 px-2 text-center w-16">
                  {tTournament("group")}
                </th>
                <th className="py-1 px-1 text-center w-10">
                  {tTournament("pts")}
                </th>
                <th className="py-1 px-1 text-center w-8">
                  {tTournament("gf")}
                </th>
                <th className="py-1 px-1 text-center w-8">
                  {tTournament("ga")}
                </th>
                <th className="py-1 px-1 text-center w-8">
                  {tTournament("gd")}
                </th>
                <th className="py-1 px-1 text-center w-24">{t("factor")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline/10 dark:divide-ash/10 select-none">
              {thirdsList.map((item, index) => {
                const team = getTeamById(item.teamId, locale);
                if (!team) return null;

                const isThirdTied = thirdsTieClusters.some((cluster) =>
                  cluster.includes(item.teamId),
                );
                const gdSign = item.gd > 0 ? `+${item.gd}` : item.gd;

                return (
                  <tr
                    key={item.teamId}
                    className={cn(
                      "text-xs font-semibold transition-colors duration-200 border-l-2",
                      isThirdTied
                        ? "bg-amber-500/5 dark:bg-amber-500/10 border-l-amber-500"
                        : "border-l-transparent",
                    )}
                  >
                    <td className="py-2 px-1 font-[family-name:var(--font-oswald)] text-[10px] text-mute dark:text-stone text-left">
                      {index + 1}
                    </td>
                    <td className="py-2 px-2 text-left">
                      <TeamBadge
                        team={team}
                        size="compact"
                        border={false}
                        showGrip={false}
                      />
                    </td>
                    <td className="py-2 px-2 text-center text-[10px] font-bold uppercase text-mute dark:text-stone">
                      {tGroupStage("group", { letter: item.groupLetter })}
                    </td>
                    <td className="py-2 px-1 text-center font-bold text-ink dark:text-canvas">
                      {item.pts}
                    </td>
                    <td className="py-2 px-1 text-center font-normal text-[10px] text-mute dark:text-stone">
                      {item.gf}
                    </td>
                    <td className="py-2 px-1 text-center font-normal text-[10px] text-mute dark:text-stone">
                      {item.ga}
                    </td>
                    <td className="py-2 px-1 text-center font-bold text-[10px] text-mute dark:text-stone">
                      {gdSign}
                    </td>
                    <td className="py-2 px-1 text-center">
                      <FactorInput
                        initialValue={item.factor}
                        onSave={(val) =>
                          handleSaveThirdsFactor(item.teamId, val)
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
