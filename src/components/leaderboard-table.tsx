"use client";

import { ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { LeaderboardEntry } from "@/modules/leaderboard/domain/leaderboard";

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  currentUserId?: string;
  tournamentEnded?: boolean;
  className?: string;
  communitySlug?: string;
}

export function LeaderboardTable({
  entries,
  currentUserId,
  tournamentEnded = false,
  className,
  communitySlug,
}: LeaderboardTableProps) {
  const t = useTranslations("leaderboard");

  if (entries.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-xl border border-dashed border-hairline bg-canvas p-10 text-center dark:bg-ink",
          className,
        )}
      >
        <p className="text-body-md text-muted-foreground">{t("noBets")}</p>
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
      <div className="grid grid-cols-[3.5rem_1fr_auto_6rem] items-center gap-4 border-b border-hairline bg-soft-cloud/50 px-6 py-3.5 text-caption-sm uppercase tracking-wider text-muted-foreground dark:border-ash dark:bg-charcoal/30">
        <span className="text-center">{t("rank")}</span>
        <span>{t("participant")}</span>
        <span />
        <span className="text-right">{t("points")}</span>
      </div>

      {/* Table Rows */}
      <ul className="divide-y divide-hairline dark:divide-ash">
        {entries.map((entry) => {
          const isCurrentUser = currentUserId && entry.userId === currentUserId;
          const href = communitySlug
            ? `/communities/${communitySlug}/bets/${entry.betId}`
            : `/bets/${entry.betId}`;
          return (
            <li
              key={entry.betId}
              className={cn(
                "grid grid-cols-[3.5rem_1fr_auto_6rem] items-center gap-4 px-6 py-4 transition-all duration-200 hover:bg-soft-cloud/30 dark:hover:bg-charcoal/20",
                isCurrentUser &&
                  "bg-info/5 hover:bg-info/10 dark:bg-info-deep/10 dark:hover:bg-info-deep/15",
              )}
            >
              {/* Rank Position (Plain Number, or Cup if tournament ended and 1st) */}
              <span className="flex justify-center text-body-strong font-semibold tabular-nums text-foreground">
                {tournamentEnded && entry.rank === 1 ? "🏆" : entry.rank}
              </span>

              {/* Participant & Bet Info */}
              <div className="flex items-center gap-4 min-w-0">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-soft-cloud text-caption-md font-semibold text-muted-foreground dark:bg-charcoal dark:text-stone">
                  {entry.userName.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 space-y-1">
                  <p className="truncate text-body-strong text-foreground">
                    {communitySlug || isCurrentUser ? (
                      <Link
                        href={href}
                        className="hover:underline transition-colors font-medium"
                      >
                        {entry.betName}
                      </Link>
                    ) : (
                      <span className="font-medium">{entry.betName}</span>
                    )}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-caption-sm text-muted-foreground">
                    <span className="font-normal">{entry.userName}</span>
                    {isCurrentUser && (
                      <span className="inline-flex items-center rounded-full border border-info/30 bg-info/10 px-2 py-0.5 text-utility-xs uppercase tracking-wide text-info dark:border-info-deep/50 dark:bg-info-deep/20 dark:text-info">
                        {t("you")}
                      </span>
                    )}
                    {entry.signature && (
                      <span
                        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
                        title={entry.signature}
                      >
                        <ShieldCheck
                          className="size-3.5 text-success"
                          aria-hidden="true"
                        />
                        <code className="font-mono text-xs">
                          {entry.signature.slice(0, 8)}
                        </code>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* View Button */}
              <div className="flex justify-end">
                <Link
                  href={href}
                  className="button-secondary text-button-sm !h-9 !py-1 !px-4 flex items-center justify-center shrink-0"
                >
                  {t("view")}
                </Link>
              </div>

              {/* Points Value */}
              <span className="text-right text-body-strong font-bold tabular-nums text-foreground">
                {entry.points}
                <span className="ml-1 text-caption-sm font-medium text-muted-foreground">
                  {t("pts")}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
