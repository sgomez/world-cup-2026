"use client";

import { Gamepad2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type ArcadeRunState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "started"; runId: string; playDay: string }
  | { kind: "already_played" }
  | { kind: "error" };

interface ArcadeStartProps {
  /** Whether the logged-in user has already played today (server-determined). */
  hasPlayedToday: boolean;
  /** Feature flag: game is playable. When false, renders a disabled button. */
  enabled: boolean;
}

/**
 * ArcadeStart — the Penguin Run start control shown on the rankings area.
 *
 * Shows a "Play" button when the User has not yet played today, or an
 * "already played" state with the reset time when they have.
 *
 * Calls POST /api/arcade/start; server clock is authoritative.
 */
export function ArcadeStart({ hasPlayedToday, enabled }: ArcadeStartProps) {
  const t = useTranslations("arcade");
  const [state, setState] = useState<ArcadeRunState>(
    hasPlayedToday ? { kind: "already_played" } : { kind: "idle" },
  );

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

  async function handleStart() {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/arcade/start", { method: "POST" });
      if (res.status === 201) {
        const data = await res.json();
        setState({
          kind: "started",
          runId: data.id,
          playDay: data.playDay,
        });
      } else if (res.status === 409) {
        setState({ kind: "already_played" });
      } else {
        setState({ kind: "error" });
      }
    } catch {
      setState({ kind: "error" });
    }
  }

  if (state.kind === "already_played" || state.kind === "started") {
    return (
      <div className="flex flex-col items-center gap-1 rounded-xl border border-hairline bg-soft-cloud/50 p-4 text-center dark:border-ash dark:bg-charcoal/20">
        <div className="flex items-center gap-2 text-body-sm text-muted-foreground">
          <Gamepad2 className="size-4" aria-hidden="true" />
          <span>{t("alreadyPlayedToday")}</span>
        </div>
        <span className="text-caption-sm text-muted-foreground/70">
          {t("resetsAt")}
        </span>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-hairline bg-soft-cloud/50 p-4 text-center dark:border-ash dark:bg-charcoal/20">
        <p className="text-body-sm text-destructive">{t("startError")}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setState({ kind: "idle" })}
        >
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
        disabled={state.kind === "loading"}
        onClick={handleStart}
      >
        <Gamepad2 className="size-4" aria-hidden="true" />
        {state.kind === "loading" ? t("starting") : t("playButton")}
      </Button>
    </div>
  );
}
