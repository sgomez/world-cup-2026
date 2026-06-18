"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  GAME_INITIAL_SPAWN_INTERVAL_MS,
  GAME_INITIAL_SPEED,
  GAME_RAMP_INTERVAL_MS,
  GAME_SPAWN_INTERVAL_FLOOR_MS,
  GAME_SPAWN_INTERVAL_RAMP_MS,
  GAME_SPEED_CAP,
  GAME_SPEED_RAMP,
} from "@/config/arcade";
import { POINTS_PER_SECOND } from "@/modules/arcade/domain/penguin-run";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FONT_SIZE = 48;
const GROUND_HEIGHT = 8;
/** Penguin horizontal position as fraction of canvas width. */
const PENGUIN_X_FRACTION = 0.2;
/** Approximate bounding box for emoji collision (fraction of font size). */
const EMOJI_BOX_FRACTION = 0.7;

const JUMP_VELOCITY = -700; // px/s (negative = up)
const GRAVITY = 1800; // px/s²

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GamePhase = "playing" | "between-rounds" | "game-over" | "round-error";

interface Snowman {
  x: number;
  y: number;
}

interface MutableGameState {
  phase: GamePhase;
  /** Current round number (1-based). */
  round: number;
  /** When the current round started (Date.now() ms). */
  roundStartedAt: number;
  /** Elapsed seconds in the current round (used for HUD + score). */
  elapsedSeconds: number;
  /** Best score across rounds. */
  bestScore: number;
  /** Score of the round that just ended (shown on between-round screen). */
  lastRoundScore: number;
  /** How many rounds have been played (i.e., completed). */
  roundsPlayed: number;
  /** Penguin vertical position (px from top, 0 = top of canvas). */
  penguinY: number;
  /** Penguin vertical velocity (px/s). */
  penguinVY: number;
  /** Current scroll speed (px/s). */
  scrollSpeed: number;
  /** Current snowman spawn interval (ms). */
  spawnIntervalMs: number;
  /** Elapsed time since last speed ramp (ms). */
  rampAccumulator: number;
  /** Snowmen on screen. */
  snowmen: Snowman[];
  /** Time since last snowman spawned (ms). */
  spawnAccumulator: number;
  /** Whether the penguin is on the ground. */
  onGround: boolean;
  /** Timestamp of the previous frame (ms from performance.now()). */
  lastTimestamp: number;
}

export interface PenguinRunGameProps {
  runId: string;
  onFinished: () => void;
}

// ---------------------------------------------------------------------------
// Helpers (module-level, stable across renders)
// ---------------------------------------------------------------------------

function getGroundY(canvas: HTMLCanvasElement): number {
  return canvas.height - GROUND_HEIGHT - FONT_SIZE;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * PenguinRunGame — full-screen canvas Penguin Run game overlay.
 *
 * Accepts `{ runId, onFinished }`. Renders a `position: fixed` overlay
 * containing a `<canvas>` element. All game loop state lives in mutable
 * refs; React state is used only for phase transitions.
 */
export function PenguinRunGame({ runId, onFinished }: PenguinRunGameProps) {
  const t = useTranslations("arcade");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<MutableGameState | null>(null);
  const rafIdRef = useRef<number>(0);

  type ScreenState =
    | { kind: "playing" }
    | {
        kind: "between-rounds";
        roundScore: number;
        livesRemaining: number;
        bestScore: number;
      }
    | { kind: "game-over"; bestScore: number }
    | { kind: "round-error" };

  const [screen, setScreen] = useState<ScreenState>({ kind: "playing" });

  // -------------------------------------------------------------------------
  // API calls
  // -------------------------------------------------------------------------

  const reportRound = useCallback(
    async (roundStartedAt: number, reportedScore: number) => {
      try {
        const res = await fetch("/api/arcade/round", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            runId,
            roundStartedAt: new Date(roundStartedAt).toISOString(),
            reportedScore,
          }),
        });
        if (!res.ok) return null;
        return await res.json();
      } catch {
        return null;
      }
    },
    [runId],
  );

  const finishRun = useCallback(async () => {
    try {
      await fetch("/api/arcade/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId }),
      });
    } catch {
      // silently ignore — server will finalise via stale heartbeat
    }
  }, [runId]);

  // -------------------------------------------------------------------------
  // Collision handler — called from the game loop
  // -------------------------------------------------------------------------

  const handleCollision = useCallback(async () => {
    const g = gameRef.current;
    if (!g) return;

    const roundScore = Math.floor(g.elapsedSeconds * POINTS_PER_SECOND);
    const roundStartedAt = g.roundStartedAt;

    const data = await reportRound(roundStartedAt, roundScore);

    if (!data) {
      // API error — show retry overlay
      if (gameRef.current) gameRef.current.phase = "round-error";
      setScreen({ kind: "round-error" });
      return;
    }

    const serverBestScore: number = data.bestScore ?? 0;
    const roundsPlayed: number = data.roundsPlayed ?? 1;
    const isFinished: boolean = data.status === "finished";

    if (gameRef.current) {
      gameRef.current.roundsPlayed = roundsPlayed;
      gameRef.current.bestScore = serverBestScore;
      gameRef.current.lastRoundScore = roundScore;
    }

    if (isFinished) {
      await finishRun();
      if (gameRef.current) gameRef.current.phase = "game-over";
      setScreen({ kind: "game-over", bestScore: serverBestScore });
    } else {
      const livesRemaining = 3 - roundsPlayed;
      if (gameRef.current) gameRef.current.phase = "between-rounds";
      setScreen({
        kind: "between-rounds",
        roundScore,
        livesRemaining,
        bestScore: serverBestScore,
      });
    }
  }, [reportRound, finishRun]);

  // -------------------------------------------------------------------------
  // Game loop
  // -------------------------------------------------------------------------

  const resetRound = useCallback((canvas: HTMLCanvasElement) => {
    const g = gameRef.current;
    if (!g) return;
    g.phase = "playing";
    g.roundStartedAt = Date.now();
    g.elapsedSeconds = 0;
    g.penguinY = getGroundY(canvas);
    g.penguinVY = 0;
    g.onGround = true;
    g.scrollSpeed = GAME_INITIAL_SPEED;
    g.spawnIntervalMs = GAME_INITIAL_SPAWN_INTERVAL_MS;
    g.rampAccumulator = 0;
    g.snowmen = [];
    g.spawnAccumulator = 0;
  }, []);

  const tick = useCallback(
    (timestamp: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const g = gameRef.current;
      if (!g) return;

      if (g.phase !== "playing") return; // pause loop while in overlay

      const dt =
        g.lastTimestamp === 0 ? 0 : (timestamp - g.lastTimestamp) / 1000;
      g.lastTimestamp = timestamp;

      // --- physics ---
      g.penguinVY += GRAVITY * dt;
      g.penguinY += g.penguinVY * dt;
      const groundY = getGroundY(canvas);
      if (g.penguinY >= groundY) {
        g.penguinY = groundY;
        g.penguinVY = 0;
        g.onGround = true;
      }

      // --- score (elapsed seconds) ---
      g.elapsedSeconds += dt;

      // --- speed ramp ---
      g.rampAccumulator += dt * 1000;
      if (g.rampAccumulator >= GAME_RAMP_INTERVAL_MS) {
        g.rampAccumulator -= GAME_RAMP_INTERVAL_MS;
        g.scrollSpeed = Math.min(
          g.scrollSpeed + GAME_SPEED_RAMP,
          GAME_SPEED_CAP,
        );
        g.spawnIntervalMs = Math.max(
          g.spawnIntervalMs - GAME_SPAWN_INTERVAL_RAMP_MS,
          GAME_SPAWN_INTERVAL_FLOOR_MS,
        );
      }

      // --- spawn snowmen ---
      g.spawnAccumulator += dt * 1000;
      if (g.spawnAccumulator >= g.spawnIntervalMs) {
        g.spawnAccumulator = 0;
        g.snowmen.push({ x: canvas.width + FONT_SIZE, y: groundY });
      }

      // --- move snowmen ---
      for (const s of g.snowmen) {
        s.x -= g.scrollSpeed * dt;
      }
      g.snowmen = g.snowmen.filter((s) => s.x > -FONT_SIZE * 2);

      // --- collision detection ---
      const penguinX = canvas.width * PENGUIN_X_FRACTION;
      const boxSize = FONT_SIZE * EMOJI_BOX_FRACTION;
      for (const s of g.snowmen) {
        const px = penguinX;
        const py = g.penguinY;
        if (
          px < s.x + boxSize &&
          px + boxSize > s.x &&
          py < s.y + boxSize &&
          py + boxSize > s.y
        ) {
          g.phase = "between-rounds"; // pause loop to prevent re-entry
          void handleCollision();
          return; // stop this frame
        }
      }

      // --- draw ---
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Ground
      ctx.fillStyle = "#39393b"; // charcoal
      ctx.fillRect(
        0,
        canvas.height - GROUND_HEIGHT,
        canvas.width,
        GROUND_HEIGHT,
      );

      // Penguin
      ctx.font = `${FONT_SIZE}px sans-serif`;
      ctx.textBaseline = "top";
      ctx.fillText("🐧", penguinX, g.penguinY);

      // Snowmen
      for (const s of g.snowmen) {
        ctx.fillText("⛄", s.x, s.y);
      }

      // HUD — score top-right
      const hudScore = Math.floor(g.elapsedSeconds * POINTS_PER_SECOND);
      ctx.font = "bold 20px sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      ctx.fillText(String(hudScore), canvas.width - 16, 16);
      ctx.textAlign = "left"; // reset

      rafIdRef.current = requestAnimationFrame(tick);
    },
    [handleCollision],
  );

  // -------------------------------------------------------------------------
  // Mount / unmount
  // -------------------------------------------------------------------------

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Size canvas to viewport
    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    // Initialise mutable state
    const g: MutableGameState = {
      phase: "playing",
      round: 1,
      roundStartedAt: Date.now(),
      elapsedSeconds: 0,
      bestScore: 0,
      lastRoundScore: 0,
      roundsPlayed: 0,
      penguinY: getGroundY(canvas),
      penguinVY: 0,
      scrollSpeed: GAME_INITIAL_SPEED,
      spawnIntervalMs: GAME_INITIAL_SPAWN_INTERVAL_MS,
      rampAccumulator: 0,
      snowmen: [],
      spawnAccumulator: 0,
      onGround: true,
      lastTimestamp: 0,
    };
    gameRef.current = g;

    // Start loop
    rafIdRef.current = requestAnimationFrame(tick);

    // Heartbeat
    const heartbeatId = setInterval(() => {
      void fetch("/api/arcade/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId }),
      }).catch(() => {
        // silently swallow — a missed ping does not interrupt gameplay
      });
    }, 30_000);

    // Jump controls
    function jump() {
      const g = gameRef.current;
      if (g?.phase !== "playing") return;
      if (!g.onGround) return; // single jump only
      g.penguinVY = JUMP_VELOCITY;
      g.onGround = false;
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === " ") {
        e.preventDefault();
        jump();
      }
    }

    function onPointerDown() {
      jump();
    }

    window.addEventListener("keydown", onKeyDown);
    canvas.addEventListener("pointerdown", onPointerDown);

    // Test hook — allows tests to trigger a collision via a custom DOM event
    function onTestCollision() {
      const g = gameRef.current;
      if (g?.phase !== "playing") return;
      g.phase = "between-rounds";
      void handleCollision();
    }
    canvas.addEventListener(
      "__test_collision__",
      onTestCollision as EventListener,
    );

    return () => {
      cancelAnimationFrame(rafIdRef.current);
      clearInterval(heartbeatId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener(
        "__test_collision__",
        onTestCollision as EventListener,
      );
    };
  }, [runId, tick, handleCollision]);

  // -------------------------------------------------------------------------
  // Handlers for HTML overlay buttons
  // -------------------------------------------------------------------------

  function handleNextRound() {
    const canvas = canvasRef.current;
    if (!canvas || !gameRef.current) return;
    gameRef.current.round += 1;
    resetRound(canvas);
    setScreen({ kind: "playing" });
    gameRef.current.lastTimestamp = 0;
    rafIdRef.current = requestAnimationFrame(tick);
  }

  function handleViewRanking() {
    onFinished();
  }

  function handleRetry() {
    const canvas = canvasRef.current;
    if (!canvas || !gameRef.current) return;
    // re-attempt round report with same round state — simplest UX is to restart round
    resetRound(canvas);
    setScreen({ kind: "playing" });
    gameRef.current.lastTimestamp = 0;
    rafIdRef.current = requestAnimationFrame(tick);
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div
      data-testid="penguin-run-overlay"
      className="fixed inset-0 z-[200] bg-black/85"
      style={{ isolation: "isolate" }}
    >
      <canvas
        ref={canvasRef}
        data-testid="penguin-run-canvas"
        className="block h-full w-full"
        aria-label="Penguin Run game canvas"
      />

      {/* Between-round overlay */}
      {screen.kind === "between-rounds" && (
        <div
          data-testid="between-round-screen"
          className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black/70"
        >
          <p className="text-heading-xl font-medium text-white uppercase tracking-tight">
            {t("round")} {gameRef.current?.round ?? 1}
          </p>
          <p className="text-body-md text-white/80">
            {t("roundScore")}: {screen.roundScore}
          </p>
          <p className="text-body-md text-white/80">
            {t("bestScore")}: {screen.bestScore}
          </p>
          <p className="text-caption-md text-white/70">
            {t("livesRemaining", { count: screen.livesRemaining })}
          </p>
          <Button variant="default" size="sm" onClick={handleNextRound}>
            {t("nextRound")}
          </Button>
        </div>
      )}

      {/* Round error overlay */}
      {screen.kind === "round-error" && (
        <div
          data-testid="round-error-screen"
          className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black/70"
        >
          <p className="text-body-md text-destructive">{t("roundError")}</p>
          <Button variant="outline" size="sm" onClick={handleRetry}>
            {t("retryRound")}
          </Button>
        </div>
      )}

      {/* Game-over overlay */}
      {screen.kind === "game-over" && (
        <div
          data-testid="game-over-screen"
          className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black/70"
        >
          <p className="text-heading-xl font-medium text-white uppercase tracking-tight">
            {t("runFinished")}
          </p>
          <p className="text-body-md text-white/80">
            {t("bestScore")}: {screen.bestScore}
          </p>
          <Button variant="default" size="sm" onClick={handleViewRanking}>
            {t("viewRanking")}
          </Button>
        </div>
      )}
    </div>
  );
}
