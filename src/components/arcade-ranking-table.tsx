"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type ArcadeRankingEntry = {
  rank: number;
  userId: string;
  userName: string;
  bestScore: number;
  achievedAt: Date;
};

interface ArcadeRankingTableProps {
  entries: ArcadeRankingEntry[];
  currentUserId?: string;
  className?: string;
}

export function ArcadeRankingTable({
  entries,
  currentUserId,
  className,
}: ArcadeRankingTableProps) {
  const t = useTranslations("arcade");

  if (entries.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-xl border border-dashed border-hairline bg-canvas p-10 text-center dark:bg-ink",
          className,
        )}
      >
        <p className="text-body-md text-muted-foreground">{t("noScores")}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-hairline bg-card shadow-sm transition-all dark:border-ash",
        className,
      )}
    >
      {/* Table Header */}
      <div className="grid grid-cols-[2.25rem_1fr_5rem] sm:grid-cols-[3rem_1fr_6rem] items-center gap-2 sm:gap-4 border-b border-hairline bg-soft-cloud/50 px-3 py-2.5 sm:px-6 sm:py-3 text-caption-sm uppercase tracking-wider text-muted-foreground dark:border-ash dark:bg-charcoal/30">
        <span className="text-center">{t("rank")}</span>
        <span>{t("player")}</span>
        <span className="text-right">{t("score")}</span>
      </div>

      {/* Table Rows */}
      <ul className="divide-y divide-hairline dark:divide-ash">
        {entries.map((entry) => {
          const isCurrentUser = currentUserId && entry.userId === currentUserId;
          return (
            <li
              key={entry.userId}
              className={cn(
                "grid grid-cols-[2.25rem_1fr_5rem] sm:grid-cols-[3rem_1fr_6rem] items-center gap-2 sm:gap-4 px-3 py-2.5 sm:px-6 sm:py-3 transition-all duration-200",
                isCurrentUser
                  ? "bg-info/5 dark:bg-info-deep/10"
                  : "hover:bg-soft-cloud/30 dark:hover:bg-charcoal/20",
              )}
            >
              {/* Rank */}
              <span className="flex justify-center text-body-strong font-semibold tabular-nums text-foreground">
                {entry.rank === 1
                  ? "🥇"
                  : entry.rank === 2
                    ? "🥈"
                    : entry.rank === 3
                      ? "🥉"
                      : entry.rank}
              </span>

              {/* Player */}
              <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                <span className="hidden sm:flex size-9 shrink-0 items-center justify-center rounded-full bg-soft-cloud text-caption-md font-semibold text-muted-foreground dark:bg-charcoal dark:text-stone">
                  {entry.userName.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate font-medium text-caption-md sm:text-body-strong text-foreground">
                    {entry.userName}
                  </p>
                  {isCurrentUser && (
                    <span className="inline-flex items-center rounded-full border border-info/30 bg-info/10 px-1.5 py-0.5 text-utility-xs uppercase tracking-wide text-info dark:border-info-deep/50 dark:bg-info-deep/20 dark:text-info">
                      {t("you")}
                    </span>
                  )}
                </div>
              </div>

              {/* Score */}
              <span className="text-right text-body-strong font-bold tabular-nums text-foreground text-caption-md sm:text-body-strong">
                {entry.bestScore}
                <span className="ml-1 text-xs sm:text-caption-sm font-medium text-muted-foreground">
                  {t("score").toLowerCase()}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
