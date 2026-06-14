"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { TeamBadge } from "@/components/team-badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Team } from "@/modules/teams";

export type GroupStandingsRow = {
  teamId: string;
  position: number;
  pts: number;
  gf: number;
  ga: number;
  gd: number;
  qualified: boolean;
  team: Team;
};

export type GroupStandingsCardProps = {
  title: string;
  titleIcon?: ReactNode;
  qualifyLabel: string;
  rows: GroupStandingsRow[];
  liveTeamIds: Set<string>;
  rowSuffix?: (row: GroupStandingsRow) => ReactNode;
};

export function GroupStandingsCard({
  title,
  titleIcon,
  qualifyLabel,
  rows,
  liveTeamIds,
  rowSuffix,
}: GroupStandingsCardProps) {
  const t = useTranslations("tournament");

  return (
    <Card className="flex flex-col">
      <CardHeader className="mb-3 flex items-center justify-between gap-2">
        <span className="font-display-campaign text-sm font-bold uppercase tracking-wider text-ink dark:text-canvas flex items-center gap-1.5">
          {titleIcon}
          {title}
        </span>
        <span className="rounded-full bg-soft-cloud px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-mute dark:bg-charcoal dark:text-stone">
          {qualifyLabel}
        </span>
      </CardHeader>

      <CardBody>
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-[10px] font-bold uppercase tracking-wider text-mute dark:text-stone border-b border-hairline/30 dark:border-ash/30">
              <th className="py-1 px-1 text-left w-6">{t("pos")}</th>
              <th className="py-1 px-2 text-left">{t("team")}</th>
              <th className="py-1 px-1.5 text-center w-10">{t("pts")}</th>
              <th className="py-1 px-1 text-center w-7">{t("gf")}</th>
              <th className="py-1 px-1 text-center w-7">{t("ga")}</th>
              <th className="py-1 px-1.5 text-center w-8">{t("gd")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline/10 dark:divide-ash/10 select-none">
            {rows.map((row) => {
              const gdSign = row.gd > 0 ? `+${row.gd}` : row.gd;
              return (
                <tr
                  key={row.teamId}
                  className={cn(
                    "text-sm font-semibold transition-opacity duration-200",
                    !row.qualified && "opacity-50 grayscale",
                  )}
                >
                  <td className="py-1.5 px-1 font-[family-name:var(--font-oswald)] text-xs text-mute dark:text-stone text-left">
                    {row.position}
                  </td>
                  <td className="py-1.5 px-1 w-full max-w-[150px]">
                    <div className="flex items-center gap-1.5">
                      <TeamBadge
                        team={row.team}
                        size="compact"
                        border={false}
                        showGrip={false}
                      />
                      {liveTeamIds.has(row.teamId) && (
                        <span className="animate-pulse rounded px-1 py-0.5 text-[8px] font-bold uppercase tracking-wider bg-sale/10 text-sale dark:bg-sale/20 shrink-0">
                          {t("liveMarker")}
                        </span>
                      )}
                      {rowSuffix?.(row)}
                    </div>
                  </td>
                  <td className="py-1.5 px-1.5 text-center font-[family-name:var(--font-oswald)] text-xs text-ink dark:text-canvas">
                    {row.pts}
                  </td>
                  <td className="py-1.5 px-1 text-center font-[family-name:var(--font-oswald)] text-xs text-ink dark:text-canvas">
                    {row.gf}
                  </td>
                  <td className="py-1.5 px-1 text-center font-[family-name:var(--font-oswald)] text-xs text-ink dark:text-canvas">
                    {row.ga}
                  </td>
                  <td
                    className={cn(
                      "py-1.5 px-1.5 text-center text-xs font-medium font-[family-name:var(--font-oswald)]",
                      row.gd > 0
                        ? "text-success dark:text-success-bright"
                        : row.gd < 0
                          ? "text-sale"
                          : "text-ink dark:text-canvas",
                    )}
                  >
                    {gdSign}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardBody>
    </Card>
  );
}
