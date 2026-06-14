"use client";

import { MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { placeholderLabel } from "@/components/placeholder-label";
import { TeamBadge } from "@/components/team-badge";
import type { MatchPhase } from "@/modules/live/domain/live-feed";
import { estimateLiveMinute } from "@/modules/live/domain/live-minute";
import { getKickoffInstant } from "@/modules/schedule";
import { getTeamByName } from "@/modules/teams";

export type MatchCardProps = {
  round: string;
  date: string;
  time: string;
  team1: string;
  team2: string;
  group?: string;
  ground: string;
  locale: string;
  status: "LIVE" | "FINISHED" | "UPCOMING";
  score1?: string;
  score2?: string;
  /** Live match phase for minute estimation (display only) */
  livePhase?: MatchPhase | null;
  /** Persisted minute from feed (display only) */
  liveMinute?: number | null;
  /** Whether the feed reported stoppage time */
  liveInStoppage?: boolean | null;
  /** When the live result was last updated (for client estimation) */
  liveUpdatedAt?: Date;
};

function PlaceholderRow({ label, score }: { label: string; score?: string }) {
  return (
    <div className="relative overflow-hidden rounded-md flex items-center select-none w-full h-11 px-4 py-2 border border-dashed border-hairline bg-canvas/30 text-mute dark:border-ash dark:bg-ink/30 dark:text-stone">
      <div
        className="absolute inset-y-0 left-0 w-12 pointer-events-none transition-all duration-200 flex items-center justify-center bg-soft-cloud/50 dark:bg-charcoal/50"
        style={{
          WebkitMaskImage:
            "linear-gradient(to right, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0) 100%)",
          maskImage:
            "linear-gradient(to right, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0) 100%)",
        }}
      >
        <span className="font-bold text-xs opacity-40">?</span>
      </div>
      <div className="relative z-10 flex items-center justify-between w-full gap-2 pl-4">
        <span className="font-[family-name:var(--font-oswald)] uppercase tracking-wider font-semibold truncate text-sm opacity-60">
          {label}
        </span>
        {score !== undefined && (
          <div className="flex h-7 w-8 items-center justify-center rounded bg-soft-cloud/50 dark:bg-charcoal/50 text-sm font-bold text-ink/40 dark:text-canvas/40 border border-hairline/50 dark:border-ash/50 shrink-0 z-20">
            {score}
          </div>
        )}
      </div>
    </div>
  );
}

export function MatchCard({
  date,
  time,
  team1,
  team2,
  group,
  ground,
  locale,
  status,
  score1,
  score2,
  livePhase,
  liveMinute,
  liveInStoppage,
  liveUpdatedAt,
}: MatchCardProps) {
  const t = useTranslations("calendar");

  const [localTime, setLocalTime] = useState(time);
  const [displayMinute, setDisplayMinute] = useState<string | null>(null);

  useEffect(() => {
    getKickoffInstant({ date, time }).match(
      (dateObj) => {
        const formatted = new Intl.DateTimeFormat(locale, {
          hour: "2-digit",
          minute: "2-digit",
          timeZoneName: "short",
        }).format(dateObj);
        setLocalTime(formatted);
      },
      (err) => {
        console.error(err);
      },
    );
  }, [time, date, locale]);

  // Client-side live minute estimation, advancing every 30 seconds
  useEffect(() => {
    if (status !== "LIVE" || !livePhase) {
      setDisplayMinute(null);
      return;
    }
    const update = () => {
      setDisplayMinute(
        estimateLiveMinute(
          livePhase,
          liveMinute,
          liveInStoppage,
          liveUpdatedAt,
          new Date(),
        ),
      );
    };
    update();
    const interval = setInterval(update, 30_000);
    return () => clearInterval(interval);
  }, [status, livePhase, liveMinute, liveInStoppage, liveUpdatedAt]);

  const t1 = getTeamByName(team1, locale);
  const t2 = getTeamByName(team2, locale);

  const isT1Placeholder = !t1;
  const isT2Placeholder = !t2;

  const t1Label = isT1Placeholder ? placeholderLabel(team1, t) : t1.name;
  const t2Label = isT2Placeholder ? placeholderLabel(team2, t) : t2.name;

  return (
    <div className="rounded-xl border border-hairline bg-canvas p-4 shadow-sm transition-all duration-200 hover:shadow-md dark:border-ash dark:bg-ink flex flex-col justify-between">
      <div>
        {/* Header Info */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-2 dark:border-ash">
          <div className="flex items-center gap-2 text-xs font-semibold text-mute dark:text-stone">
            <span>{localTime}</span>
            {group && (
              <>
                <span className="opacity-40">•</span>
                <span className="uppercase tracking-wider text-ink dark:text-canvas">
                  {group}
                </span>
              </>
            )}
          </div>

          {/* Status Badge */}
          {status === "LIVE" ? (
            <span className="inline-flex items-center gap-1 rounded bg-sale/10 px-2 py-0.5 text-[10px] font-bold tracking-wider text-sale uppercase animate-pulse">
              <span className="h-1.5 w-1.5 rounded-full bg-sale" />
              {t("live")}
              {displayMinute !== null && (
                <span className="ml-0.5">{displayMinute}</span>
              )}
            </span>
          ) : status === "FINISHED" ? (
            <span className="rounded bg-soft-cloud px-2 py-0.5 text-[10px] font-bold tracking-wider text-mute uppercase dark:bg-charcoal dark:text-stone">
              {t("finished")}
            </span>
          ) : (
            <span className="rounded bg-soft-cloud/50 px-2 py-0.5 text-[10px] font-bold tracking-wider text-mute/60 uppercase dark:bg-charcoal/50 dark:text-stone/50">
              {t("upcoming")}
            </span>
          )}
        </div>

        {/* Teams Stack */}
        <div className="flex flex-col gap-2">
          {isT1Placeholder ? (
            <PlaceholderRow label={t1Label} score={score1} />
          ) : (
            <TeamBadge
              team={t1}
              size="default"
              border={true}
              showGrip={false}
              rightAddon={
                score1 !== undefined ? (
                  <div className="flex h-7 w-8 items-center justify-center rounded bg-soft-cloud dark:bg-charcoal text-sm font-bold text-ink dark:text-canvas border border-hairline dark:border-ash shrink-0 z-20">
                    {score1}
                  </div>
                ) : null
              }
            />
          )}

          {isT2Placeholder ? (
            <PlaceholderRow label={t2Label} score={score2} />
          ) : (
            <TeamBadge
              team={t2}
              size="default"
              border={true}
              showGrip={false}
              rightAddon={
                score2 !== undefined ? (
                  <div className="flex h-7 w-8 items-center justify-center rounded bg-soft-cloud dark:bg-charcoal text-sm font-bold text-ink dark:text-canvas border border-hairline dark:border-ash shrink-0 z-20">
                    {score2}
                  </div>
                ) : null
              }
            />
          )}
        </div>
      </div>

      {/* Venue (Ground) at bottom */}
      <div className="mt-3 pt-2 border-t border-hairline/50 dark:border-ash/50 flex items-center gap-1.5 text-[11px] font-semibold text-mute dark:text-stone">
        <MapPin className="h-3.5 w-3.5 shrink-0 text-mute dark:text-stone" />
        <span className="truncate" title={ground}>
          {ground}
        </span>
      </div>
    </div>
  );
}
