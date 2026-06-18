"use client";

import { useEffect, useRef, useState } from "react";
import { ArcadeInvitationModal } from "@/components/arcade-invitation-modal";
import { ArcadeStart } from "@/components/arcade-start";
import { PenguinRunGame } from "@/components/penguin-run-game";

type ArcadeRunState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "started"; runId: string; playDay: string }
  | { kind: "already_played" }
  | { kind: "error" };

type SpriteLoadState = "loading" | "ready" | "error";

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
 *
 * Sprite preloading: both penguin-walk.png and dummy.png are loaded before the
 * user can press Play. A failed load keeps the Play button disabled and never
 * calls the start API, so a loading glitch cannot consume the daily Play Day
 * (ADR 0035, #380).
 */
export function ArcadeSection({ hasPlayedToday, enabled }: ArcadeSectionProps) {
  const [state, setState] = useState<ArcadeRunState>(
    hasPlayedToday ? { kind: "already_played" } : { kind: "idle" },
  );
  const [spriteState, setSpriteState] = useState<SpriteLoadState>("loading");

  const penguinImageRef = useRef<HTMLImageElement | null>(null);
  const obstacleImageRef = useRef<HTMLImageElement | null>(null);
  const birdImageRef = useRef<HTMLImageElement | null>(null);

  // ---------------------------------------------------------------------------
  // Sprite preloading — runs on mount, before the user can press Play.
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;
    let loadedCount = 0;

    function onLoad() {
      loadedCount += 1;
      if (loadedCount === 3 && !cancelled) {
        setSpriteState("ready");
      }
    }

    function onError() {
      if (!cancelled) {
        setSpriteState("error");
      }
    }

    const penguin = new Image();
    penguin.onload = onLoad;
    penguin.onerror = onError;
    penguin.src = "/sprites/penguin-walk.png";
    penguinImageRef.current = penguin;

    const obstacle = new Image();
    obstacle.onload = onLoad;
    obstacle.onerror = onError;
    obstacle.src = "/sprites/dummy.png";
    obstacleImageRef.current = obstacle;

    const bird = new Image();
    bird.onload = onLoad;
    bird.onerror = onError;
    bird.src = "/sprites/bat.png";
    birdImageRef.current = bird;

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleStart() {
    if (!enabled) return;
    if (spriteState !== "ready") return;
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

  // Play is blocked while sprites are loading or failed.
  // The invitation modal is not gated so it still opens normally; handleStart
  // returns early if sprites aren't ready, keeping the Play Day safe.
  const spritesReady = spriteState === "ready";

  return (
    <>
      <ArcadeInvitationModal
        hasPlayedToday={hasPlayedToday}
        enabled={enabled}
        onPlay={handleStart}
        loading={state.kind === "loading"}
        error={state.kind === "error"}
      />
      {/* ArcadeStart is hidden while the game overlay occupies the screen.
       * Note: if the API call triggered from the modal fails, the modal has
       * already closed (handlePlayNow sets open=false before delegating
       * onPlay), so the error is shown here on the ArcadeStart button rather
       * than in the modal. This is intentional and tracked as a UX nit.
       */}
      {state.kind !== "started" && (
        <div className="mb-6 flex justify-end">
          <ArcadeStart
            enabled={enabled && spritesReady}
            status={state.kind}
            onPlay={handleStart}
          />
        </div>
      )}
      {/* Safety belt only: all three refs are guaranteed non-null when state.kind === "started"
          because handleStart is gated on spriteState === "ready", which is set only after
          all three refs are populated in the preload effect. */}
      {state.kind === "started" &&
        penguinImageRef.current &&
        obstacleImageRef.current &&
        birdImageRef.current && (
          <PenguinRunGame
            runId={state.runId}
            onFinished={() => setState({ kind: "already_played" })}
            penguinImage={penguinImageRef.current}
            obstacleImage={obstacleImageRef.current}
            birdImage={birdImageRef.current}
          />
        )}
    </>
  );
}
