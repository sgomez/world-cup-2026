"use client";

import { Gamepad2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/** Visible status of the page Play control (parent owns the run lifecycle). */
export type ArcadeStartStatus = "idle" | "loading" | "already_played" | "error";

interface ArcadeStartProps {
  /** Feature flag: game is playable. When false, renders a disabled button. */
  enabled: boolean;
  /** Current status, derived from the parent's run state. */
  status: ArcadeStartStatus;
  /** Called when the User presses Play / Retry. */
  onPlay: () => void;
}

/**
 * ArcadeStart — the Penguin Run start control shown on the rankings area.
 *
 * Presentational only: it renders the Play button, the loading/error/already
 * -played states, and delegates the actual run start to `onPlay`. The parent
 * (`ArcadeSection`) owns the run lifecycle and mounts the game overlay.
 */
export function ArcadeStart({ enabled, status, onPlay }: ArcadeStartProps) {
  const t = useTranslations("arcade");

  if (!enabled) {
    return (
      <div className="flex items-center justify-center">
        <Button variant="default" size="sm" disabled>
          <Gamepad2 className="size-4" aria-hidden="true" />
          {t("playButton")}
        </Button>
      </div>
    );
  }

  if (status === "already_played") {
    return (
      <div className="flex flex-col items-center gap-1 rounded-xl border border-hairline bg-soft-cloud/50 p-4 text-center dark:border-ash dark:bg-charcoal/20">
        <div className="flex items-center gap-2 text-body-sm text-muted-foreground">
          <Gamepad2 className="size-4" aria-hidden="true" />
          <span>{t("alreadyPlayedToday")}</span>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-hairline bg-soft-cloud/50 p-4 text-center dark:border-ash dark:bg-charcoal/20">
        <p className="text-body-sm text-destructive">{t("startError")}</p>
        <Button variant="outline" size="sm" onClick={onPlay}>
          {t("playButton")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center">
      <Button
        variant="default"
        size="sm"
        disabled={status === "loading"}
        onClick={onPlay}
      >
        <Gamepad2 className="size-4" aria-hidden="true" />
        {status === "loading" ? t("starting") : t("playButton")}
      </Button>
    </div>
  );
}
