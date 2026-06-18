"use client";

import { useState } from "react";
import { ArcadeInvitationModal } from "@/components/arcade-invitation-modal";
import { ArcadeStart, type ArcadeStartStatus } from "@/components/arcade-start";
import { PenguinRunGame } from "@/components/penguin-run-game";

type ArcadeRunState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "started"; runId: string; playDay: string }
  | { kind: "already_played" }
  | { kind: "error" };

interface ArcadeSectionProps {
  /** Whether the logged-in user has already played today (server-determined). */
  hasPlayedToday: boolean;
  /** Feature flag: game is playable. */
  enabled: boolean;
}

/**
 * ArcadeSection — single owner of the Penguin Run run lifecycle.
 *
 * Both entry points (the auto-opening invitation modal and the page Play
 * button) call the same `handleStart`, so starting a run always mounts the
 * game overlay. Previously the modal started a run server-side but never
 * launched the game, consuming the daily play with nothing rendered (#366).
 *
 * Calls POST /api/arcade/start; server clock is authoritative (ADR 0034).
 */
export function ArcadeSection({ hasPlayedToday, enabled }: ArcadeSectionProps) {
  const [state, setState] = useState<ArcadeRunState>(
    hasPlayedToday ? { kind: "already_played" } : { kind: "idle" },
  );

  async function handleStart() {
    if (!enabled) return;
    if (state.kind === "loading" || state.kind === "started") return;
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/arcade/start", { method: "POST" });
      if (res.status === 201) {
        const data = await res.json();
        setState({ kind: "started", runId: data.id, playDay: data.playDay });
      } else if (res.status === 409) {
        setState({ kind: "already_played" });
      } else {
        setState({ kind: "error" });
      }
    } catch {
      setState({ kind: "error" });
    }
  }

  const startStatus: ArcadeStartStatus =
    state.kind === "started" ? "idle" : state.kind;

  return (
    <>
      <ArcadeInvitationModal
        hasPlayedToday={hasPlayedToday}
        enabled={enabled}
        onPlay={handleStart}
        loading={state.kind === "loading"}
        error={state.kind === "error"}
      />
      <div className="mb-6 flex justify-end">
        <ArcadeStart
          enabled={enabled}
          status={startStatus}
          onPlay={handleStart}
        />
      </div>
      {state.kind === "started" && (
        <PenguinRunGame
          runId={state.runId}
          onFinished={() => setState({ kind: "already_played" })}
        />
      )}
    </>
  );
}
