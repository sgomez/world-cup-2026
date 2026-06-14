"use client";

import { MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { placeholderLabel } from "@/components/placeholder-label";
import { TeamBadge } from "@/components/team-badge";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/card";
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
}: MatchCardProps) {
  const t = useTranslations("calendar");

  const [localTime, setLocalTime] = useState(time);

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

  const t1 = getTeamByName(team1, locale);
  const t2 = getTeamByName(team2, locale);

  const isT1Placeholder = !t1;
  const isT2Placeholder = !t2;

  const t1Label = isT1Placeholder ? placeholderLabel(team1, t) : t1.name;
  const t2Label = isT2Placeholder ? placeholderLabel(team2, t) : t2.name;

  return (
    <Card variant="interactive" className="flex flex-col justify-between">
      {/* Header Info */}
      <CardHeader className="mb-3 flex flex-wrap items-center justify-between gap-2">
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
      </CardHeader>

      {/* Teams Stack */}
      <CardBody className="flex flex-col gap-2 mt-3">
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
      </CardBody>

      {/* Venue (Ground) at bottom */}
      <CardFooter className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-mute dark:text-stone">
        <MapPin className="h-3.5 w-3.5 shrink-0 text-mute dark:text-stone" />
        <span className="truncate" title={ground}>
          {ground}
        </span>
      </CardFooter>
    </Card>
  );
}
