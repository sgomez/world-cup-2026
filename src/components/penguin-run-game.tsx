"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { isNightMode } from "@/components/penguin-run-night-mode";
import { planNextGroup } from "@/components/penguin-run-planner";
import { Button } from "@/components/ui/button";
import {
  GAME_BIRD_FRAME_MS,
  GAME_BIRD_GROUND_CLEARANCE,
  GAME_BIRD_SIZE,
  GAME_BIRD_SPAWN_INTERVAL_MAX_MS,
  GAME_BIRD_SPAWN_INTERVAL_MIN_MS,
  GAME_BIRD_SPRITE_INSET,
  GAME_BIRD_UNLOCK_PTS,
  GAME_GRAVITY,
  GAME_GROUND_HEIGHT,
  GAME_HITBOX_FRACTION,
  GAME_INITIAL_SPEED,
  GAME_JUMP_VELOCITY,
  GAME_NIGHT_DURATION_PTS,
  GAME_NIGHT_GROUND_COLOR,
  GAME_NIGHT_INK_COLOR,
  GAME_NIGHT_INTERVAL_PTS,
  GAME_NIGHT_SKY_COLOR,
  GAME_OBS_FOOT_PAD,
  GAME_OBSTACLE_GAP_WITHIN_GROUP,
  GAME_OBSTACLE_WIDTH,
  GAME_PENGUIN_DRAW_SINK,
  GAME_PENGUIN_SPRITE_INSET,
  GAME_PENGUIN_X_FRACTION,
  GAME_RAMP_INTERVAL_MS,
  GAME_SPEED_CAP,
  GAME_SPEED_RAMP,
  GAME_SPRITE_SIZE,
  GAME_TOTAL_ROUNDS,
  GAME_WALK_FRAME_MS,
} from "@/config/arcade";
import { POINTS_PER_SECOND } from "@/modules/arcade/domain/penguin-run";

// ---------------------------------------------------------------------------
// Constants — sprite sheet (asset-specific, not tunable)
// ---------------------------------------------------------------------------

/** Penguin walk sprite sheet: 4 frames, each 32×32. */
const PENGUIN_FRAME_COUNT = 4;
const PENGUIN_FRAME_WIDTH = 32;
const PENGUIN_FRAME_HEIGHT = 32;

/** Bat sprite sheet: 2 frames, each 32×32 (64×32 total, horizontal). */
const BIRD_FRAME_COUNT = 2;
const BIRD_FRAME_WIDTH = 32;
const BIRD_FRAME_HEIGHT = 32;

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit tests)
// ---------------------------------------------------------------------------

/** Returns true once score reaches the bird unlock threshold. */
export function shouldSpawnBirds(score: number): boolean {
  return score >= GAME_BIRD_UNLOCK_PTS;
}

/** Axis-aligned bounding box in absolute canvas coordinates. */
export interface Aabb {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Penguin collision box.
 *
 * Anchored to the DRAWN sprite — the draw is shifted down by
 * GAME_PENGUIN_DRAW_SINK, so the box is too — then inset by the sprite's
 * measured transparent margins (scaled to render size). Without the sink the
 * box floats ~16px above the visible head, producing false hits when the
 * penguin jumps underneath a high bird.
 */
export function penguinHitbox(penguinX: number, penguinY: number): Aabb {
  const scale = SPRITE_SIZE / PENGUIN_FRAME_WIDTH;
  const drawTop = penguinY + GAME_PENGUIN_DRAW_SINK;
  return {
    left: penguinX + GAME_PENGUIN_SPRITE_INSET.left * scale,
    right: penguinX + SPRITE_SIZE - GAME_PENGUIN_SPRITE_INSET.right * scale,
    top: drawTop + GAME_PENGUIN_SPRITE_INSET.top * scale,
    bottom: drawTop + SPRITE_SIZE - GAME_PENGUIN_SPRITE_INSET.bottom * scale,
  };
}

/**
 * Bird (bat) collision box. The bat is drawn at bird.y with no sink; its
 * content sits with unequal top/bottom margins, so explicit insets keep the
 * box off the empty space below the wings.
 */
export function birdHitbox(birdX: number, birdY: number): Aabb {
  const scale = GAME_BIRD_SIZE / BIRD_FRAME_WIDTH;
  return {
    left: birdX + GAME_BIRD_SPRITE_INSET.left * scale,
    right: birdX + GAME_BIRD_SIZE - GAME_BIRD_SPRITE_INSET.right * scale,
    top: birdY + GAME_BIRD_SPRITE_INSET.top * scale,
    bottom: birdY + GAME_BIRD_SIZE - GAME_BIRD_SPRITE_INSET.bottom * scale,
  };
}

/** Standard AABB overlap test. */
export function aabbOverlap(a: Aabb, b: Aabb): boolean {
  return (
    a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
  );
}

// Centred play-box dimensions. On desktop the canvas is a bounded box (like
// the classic running-dinosaur game); on narrow screens it shrinks to fit.
const GAME_MAX_WIDTH = 960;
const GAME_MAX_HEIGHT = 320;
const GAME_MARGIN = 32;

// Palette for the light play-box.
const SKY_COLOR = "#e8f3fb";
const GROUND_COLOR = "#39393b"; // charcoal
const INK_COLOR = "#1a1a1a";

// ---------------------------------------------------------------------------
// Local aliases — the arcade config exports with GAME_ prefix; the loop body
// uses the short names for readability. These were bare names before the
// config rename (feat: refactor arcade config) and are aliased here to fix
// the resulting ReferenceErrors.
// ---------------------------------------------------------------------------
const GRAVITY = GAME_GRAVITY;
const SPRITE_SIZE = GAME_SPRITE_SIZE;
const TOTAL_ROUNDS = GAME_TOTAL_ROUNDS;
const WALK_FRAME_MS = GAME_WALK_FRAME_MS;
const PENGUIN_X_FRACTION = GAME_PENGUIN_X_FRACTION;
const OBS_FOOT_PAD = GAME_OBS_FOOT_PAD;
const OBSTACLE_GAP_WITHIN_GROUP = GAME_OBSTACLE_GAP_WITHIN_GROUP;
const JUMP_VELOCITY = GAME_JUMP_VELOCITY;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GamePhase =
  | "ready"
  | "playing"
  | "between-rounds"
  | "game-over"
  | "round-error";

interface Obstacle {
  x: number;
  y: number;
}

interface Bird {
  x: number;
  y: number;
  frame: number;
  frameAccMs: number;
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
  /** Elapsed time since last speed ramp (ms). */
  rampAccumulator: number;
  /** Obstacles on screen. */
  obstacles: Obstacle[];
  /**
   * Distance (px) of clear ground scrolled since the trailing edge of the
   * last Obstacle Group. Counts up until it hits `nextGroupGapPx`, at which
   * point the next group is spawned and this resets to 0.
   */
  distanceSinceLastGroup: number;
  /**
   * The clear gap (px) the game must scroll before spawning the next group.
   * Determined by `planNextGroup` after each group is emitted.
   */
  nextGroupGapPx: number;
  /** Whether the penguin is on the ground. */
  onGround: boolean;
  /** Timestamp of the previous frame (ms from performance.now()). */
  lastTimestamp: number;
  /** Current walk animation frame index (0–3). Frozen while airborne. */
  walkFrame: number;
  /** Accumulated time (ms) toward the next walk frame advance. */
  walkFrameAccMs: number;
  /** Birds currently on screen. */
  birds: Bird[];
  /** Ms accumulated toward the next bird spawn. */
  birdSpawnAccMs: number;
  /** Ms interval before the next bird spawns (randomised after each spawn). */
  nextBirdSpawnMs: number;
}

export interface PenguinRunGameProps {
  runId: string;
  onFinished: () => void;
  /** Preloaded penguin walk sprite sheet (128×32 = four 32×32 frames). */
  penguinImage: HTMLImageElement;
  /** Preloaded obstacle sprite (64×64, single frame). */
  obstacleImage: HTMLImageElement;
  /** Preloaded bat sprite sheet (64×32 = two 32×32 frames, horizontal). */
  birdImage: HTMLImageElement;
}

// ---------------------------------------------------------------------------
// Helpers (module-level, stable across renders)
// ---------------------------------------------------------------------------

function getGroundY(canvas: HTMLCanvasElement): number {
  return canvas.height - GAME_GROUND_HEIGHT - GAME_SPRITE_SIZE;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * PenguinRunGame — Penguin Run canvas game in a full-screen overlay.
 *
 * Accepts `{ runId, onFinished }`. The dimmed overlay centres a bounded
 * canvas play-box (desktop) that fills available width on narrow screens.
 * All game-loop state lives in mutable refs; React state drives only the
 * phase-transition overlays.
 */
export function PenguinRunGame({
  runId,
  onFinished,
  penguinImage,
  obstacleImage,
  birdImage,
}: PenguinRunGameProps) {
  const t = useTranslations("arcade");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<MutableGameState | null>(null);
  const rafIdRef = useRef<number>(0);

  type ScreenState =
    | { kind: "ready" }
    | { kind: "playing" }
    | {
        kind: "between-rounds";
        roundScore: number;
        livesRemaining: number;
        bestScore: number;
      }
    | { kind: "game-over"; bestScore: number }
    | { kind: "round-error" };

  const [screen, setScreen] = useState<ScreenState>({ kind: "ready" });

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
      const livesRemaining = TOTAL_ROUNDS - roundsPlayed;
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

  /** Reset positions/speed and arm the round in the "ready" phase. */
  const enterReady = useCallback((canvas: HTMLCanvasElement) => {
    const g = gameRef.current;
    if (!g) return;
    const initialPlan = planNextGroup({
      speed: GAME_INITIAL_SPEED,
      elapsedMs: 0,
      rng: Math.random,
    });
    g.phase = "ready";
    g.elapsedSeconds = 0;
    g.penguinY = getGroundY(canvas);
    g.penguinVY = 0;
    g.onGround = true;
    g.scrollSpeed = GAME_INITIAL_SPEED;
    g.rampAccumulator = 0;
    g.obstacles = [];
    g.distanceSinceLastGroup = 0;
    g.nextGroupGapPx = initialPlan.gapPx;
    g.lastTimestamp = 0;
    g.walkFrame = 0;
    g.walkFrameAccMs = 0;
    g.birds = [];
    g.birdSpawnAccMs = 0;
    g.nextBirdSpawnMs = GAME_BIRD_SPAWN_INTERVAL_MIN_MS;
  }, []);

  /** Transition from "ready" to "playing" on the first input. */
  const startRound = useCallback(() => {
    const g = gameRef.current;
    if (!g || g.phase !== "ready") return;
    g.phase = "playing";
    g.roundStartedAt = Date.now();
    g.elapsedSeconds = 0;
    g.lastTimestamp = 0;
    setScreen({ kind: "playing" });
  }, []);

  const tick = useCallback(
    (timestamp: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const g = gameRef.current;
      if (!g) return;

      // Only "ready" and "playing" animate; overlays pause the loop.
      if (g.phase !== "playing" && g.phase !== "ready") return;

      if (g.phase === "playing") {
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

        // --- walk frame animation (only while grounded) ---
        if (g.onGround) {
          g.walkFrameAccMs += dt * 1000;
          while (g.walkFrameAccMs >= WALK_FRAME_MS) {
            g.walkFrameAccMs -= WALK_FRAME_MS;
            g.walkFrame = (g.walkFrame + 1) % PENGUIN_FRAME_COUNT;
          }
        }

        // --- speed ramp ---
        g.rampAccumulator += dt * 1000;
        if (g.rampAccumulator >= GAME_RAMP_INTERVAL_MS) {
          g.rampAccumulator -= GAME_RAMP_INTERVAL_MS;
          g.scrollSpeed = Math.min(
            g.scrollSpeed + GAME_SPEED_RAMP,
            GAME_SPEED_CAP,
          );
        }

        // --- distance-based obstacle spawning (ADR 0035) ---
        const distanceDelta = g.scrollSpeed * dt;
        g.distanceSinceLastGroup += distanceDelta;

        if (g.distanceSinceLastGroup >= g.nextGroupGapPx) {
          // Overshoot: the distance beyond the gap becomes the leading edge
          // of the first obstacle in the new group.
          const overshoot = g.distanceSinceLastGroup - g.nextGroupGapPx;
          const spawnX = canvas.width + GAME_OBSTACLE_WIDTH - overshoot;

          // Plan the next group
          const plan = planNextGroup({
            speed: g.scrollSpeed,
            elapsedMs: g.elapsedSeconds * 1000,
            rng: Math.random,
          });

          // Spawn all obstacles in this group (contiguous).
          // y is shifted down by OBS_FOOT_PAD so the visible base of the
          // sprite sits on the ground line (the sprite has transparent space
          // at the bottom of its bounding box).
          const obsGroundY =
            canvas.height -
            GAME_GROUND_HEIGHT -
            GAME_OBSTACLE_WIDTH +
            OBS_FOOT_PAD;
          for (let i = 0; i < plan.size; i++) {
            g.obstacles.push({
              x: spawnX + i * (GAME_OBSTACLE_WIDTH + OBSTACLE_GAP_WITHIN_GROUP),
              y: obsGroundY,
            });
          }

          // Reset distance tracking and record next gap
          g.distanceSinceLastGroup = 0;
          g.nextGroupGapPx = plan.gapPx;
        }

        // --- move obstacles ---
        for (const obs of g.obstacles) {
          obs.x -= g.scrollSpeed * dt;
        }
        g.obstacles = g.obstacles.filter(
          (obs) => obs.x > -(GAME_OBSTACLE_WIDTH * 2),
        );

        // --- bird spawn (independent timer, after unlock threshold) ---
        const hudScore = Math.floor(g.elapsedSeconds * POINTS_PER_SECOND);
        if (shouldSpawnBirds(hudScore)) {
          g.birdSpawnAccMs += dt * 1000;
          if (g.birdSpawnAccMs >= g.nextBirdSpawnMs) {
            g.birdSpawnAccMs = 0;
            g.nextBirdSpawnMs =
              GAME_BIRD_SPAWN_INTERVAL_MIN_MS +
              Math.random() *
                (GAME_BIRD_SPAWN_INTERVAL_MAX_MS -
                  GAME_BIRD_SPAWN_INTERVAL_MIN_MS);
            const groundY = getGroundY(canvas);
            g.birds.push({
              x: canvas.width + GAME_BIRD_SIZE,
              y: groundY - GAME_BIRD_GROUND_CLEARANCE - GAME_BIRD_SIZE,
              frame: 0,
              frameAccMs: 0,
            });
          }
        }

        // --- move + animate birds ---
        for (const bird of g.birds) {
          bird.x -= g.scrollSpeed * dt;
          bird.frameAccMs += dt * 1000;
          while (bird.frameAccMs >= GAME_BIRD_FRAME_MS) {
            bird.frameAccMs -= GAME_BIRD_FRAME_MS;
            bird.frame = (bird.frame + 1) % BIRD_FRAME_COUNT;
          }
        }
        g.birds = g.birds.filter((b) => b.x > -(GAME_BIRD_SIZE * 2));

        // --- collision detection ---
        // Penguin and bird boxes are anchored to the drawn sprites and inset
        // by their measured transparent margins (see penguinHitbox/birdHitbox)
        // so they match what the player sees. Obstacles keep the centred
        // forgiving fraction — they collide on the side, where it works well.
        const penguinX = canvas.width * GAME_PENGUIN_X_FRACTION;
        const penguinBox = penguinHitbox(penguinX, g.penguinY);

        for (const obs of g.obstacles) {
          const obsHitSize = GAME_OBSTACLE_WIDTH * GAME_HITBOX_FRACTION;
          const obsHitOffset = (GAME_OBSTACLE_WIDTH - obsHitSize) / 2;
          const obsBox: Aabb = {
            left: obs.x + obsHitOffset,
            top: obs.y + obsHitOffset,
            right: obs.x + obsHitOffset + obsHitSize,
            bottom: obs.y + obsHitOffset + obsHitSize,
          };

          if (aabbOverlap(penguinBox, obsBox)) {
            g.phase = "between-rounds"; // pause loop to prevent re-entry
            void handleCollision();
            return; // stop this frame
          }
        }

        for (const bird of g.birds) {
          if (aabbOverlap(penguinBox, birdHitbox(bird.x, bird.y))) {
            g.phase = "between-rounds";
            void handleCollision();
            return;
          }
        }
      } else {
        // "ready" — keep the clock fresh so the first playing frame has dt 0.
        g.lastTimestamp = timestamp;
      }

      // --- draw ---
      const penguinX = canvas.width * PENGUIN_X_FRACTION;

      // Night-mode palette selection — pure visual, no physics change.
      const hudScore = Math.floor(g.elapsedSeconds * POINTS_PER_SECOND);
      const night = isNightMode(
        hudScore,
        GAME_NIGHT_INTERVAL_PTS,
        GAME_NIGHT_DURATION_PTS,
      );
      const skyColor = night ? GAME_NIGHT_SKY_COLOR : SKY_COLOR;
      const groundColor = night ? GAME_NIGHT_GROUND_COLOR : GROUND_COLOR;
      const inkColor = night ? GAME_NIGHT_INK_COLOR : INK_COLOR;

      // Sky background
      ctx.fillStyle = skyColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Ground
      ctx.fillStyle = groundColor;
      ctx.fillRect(
        0,
        canvas.height - GAME_GROUND_HEIGHT,
        canvas.width,
        GAME_GROUND_HEIGHT,
      );

      // Crisp pixel art — no smoothing.
      ctx.imageSmoothingEnabled = false;

      // Penguin — walk frame cycles while grounded, freezes on frame 0 airborne.
      const frameIndex = g.onGround ? g.walkFrame : 0;
      ctx.drawImage(
        penguinImage,
        frameIndex * PENGUIN_FRAME_WIDTH, // source x
        0, // source y
        PENGUIN_FRAME_WIDTH, // source width
        PENGUIN_FRAME_HEIGHT, // source height
        penguinX, // dest x
        g.penguinY + GAME_PENGUIN_DRAW_SINK, // dest y — sink to land visual feet on ground
        SPRITE_SIZE, // dest width
        SPRITE_SIZE, // dest height
      );

      // Obstacles — single frame from dummy.png (64×64 source, rendered at GAME_OBSTACLE_WIDTH).
      for (const obs of g.obstacles) {
        ctx.drawImage(
          obstacleImage,
          0,
          0,
          64,
          64, // source: full 64×64 sprite
          obs.x,
          obs.y, // dest position (y already accounts for OBS_FOOT_PAD)
          GAME_OBSTACLE_WIDTH,
          GAME_OBSTACLE_WIDTH, // dest size
        );
      }

      // Birds — bat.png: 2 frames of 32×32 (64×32 sheet), animated flap.
      for (const bird of g.birds) {
        ctx.drawImage(
          birdImage,
          bird.frame * BIRD_FRAME_WIDTH,
          0,
          BIRD_FRAME_WIDTH,
          BIRD_FRAME_HEIGHT,
          bird.x,
          bird.y,
          GAME_BIRD_SIZE,
          GAME_BIRD_SIZE,
        );
      }

      // HUD — big score, centred top, with round + record below.
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = inkColor;
      ctx.font = "bold 56px sans-serif";
      ctx.fillText(String(hudScore), canvas.width / 2, 12);
      ctx.font = "16px sans-serif";
      ctx.fillText(
        `${t("round")} ${g.round}/${TOTAL_ROUNDS}   ★ ${g.bestScore}`,
        canvas.width / 2,
        76,
      );
      ctx.textAlign = "left"; // reset

      rafIdRef.current = requestAnimationFrame(tick);
    },
    [handleCollision, t, penguinImage, obstacleImage, birdImage],
  );

  // -------------------------------------------------------------------------
  // Mount / unmount
  // -------------------------------------------------------------------------

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Size the canvas to a bounded, centred play-box.
    function resize() {
      if (!canvas) return;
      canvas.width = Math.min(window.innerWidth - GAME_MARGIN, GAME_MAX_WIDTH);
      canvas.height = Math.min(
        window.innerHeight - GAME_MARGIN,
        GAME_MAX_HEIGHT,
      );
      const g = gameRef.current;
      // Keep the penguin grounded if it is resting when the box resizes.
      if (g?.onGround) g.penguinY = getGroundY(canvas);
    }
    resize();
    window.addEventListener("resize", resize);

    // Plan the initial gap before any group spawns.
    const initialPlan = planNextGroup({
      speed: GAME_INITIAL_SPEED,
      elapsedMs: 0,
      rng: Math.random,
    });

    // Initialise mutable state
    const g: MutableGameState = {
      phase: "ready",
      round: 1,
      roundStartedAt: Date.now(),
      elapsedSeconds: 0,
      bestScore: 0,
      lastRoundScore: 0,
      roundsPlayed: 0,
      penguinY: getGroundY(canvas),
      penguinVY: 0,
      scrollSpeed: GAME_INITIAL_SPEED,
      rampAccumulator: 0,
      obstacles: [],
      distanceSinceLastGroup: 0,
      nextGroupGapPx: initialPlan.gapPx,
      onGround: true,
      lastTimestamp: 0,
      walkFrame: 0,
      walkFrameAccMs: 0,
      birds: [],
      birdSpawnAccMs: 0,
      nextBirdSpawnMs: GAME_BIRD_SPAWN_INTERVAL_MIN_MS,
    };
    gameRef.current = g;

    // Start loop (renders the static "ready" frame until first input)
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

    // Jump / start controls. The first input starts the round; subsequent
    // inputs jump (single jump only while grounded).
    function jump() {
      const g = gameRef.current;
      if (!g) return;
      if (g.phase === "ready") {
        startRound();
        return;
      }
      if (g.phase !== "playing") return;
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

    // Test hook — allows tests to trigger a collision via a custom DOM event.
    // Auto-starts the round if still in the "ready" phase.
    function onTestCollision() {
      const g = gameRef.current;
      if (!g) return;
      if (g.phase === "ready") startRound();
      if (g.phase !== "playing") return;
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
  }, [runId, tick, handleCollision, startRound]);

  // -------------------------------------------------------------------------
  // Handlers for HTML overlay buttons
  // -------------------------------------------------------------------------

  function handleNextRound() {
    const canvas = canvasRef.current;
    if (!canvas || !gameRef.current) return;
    gameRef.current.round += 1;
    enterReady(canvas);
    setScreen({ kind: "ready" });
    rafIdRef.current = requestAnimationFrame(tick);
  }

  function handleViewRanking() {
    onFinished();
  }

  /** Quit mid-run from the between-round screen: finalise then exit. */
  async function handleQuit() {
    await finishRun();
    onFinished();
  }

  function handleRetry() {
    const canvas = canvasRef.current;
    if (!canvas || !gameRef.current) return;
    enterReady(canvas);
    setScreen({ kind: "ready" });
    rafIdRef.current = requestAnimationFrame(tick);
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div
      data-testid="penguin-run-overlay"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 p-4"
      style={{ isolation: "isolate" }}
    >
      <div className="relative">
        <canvas
          ref={canvasRef}
          data-testid="penguin-run-canvas"
          className="block touch-none rounded-2xl border border-white/10 shadow-2xl"
          aria-label="Penguin Run game canvas"
        />

        {/* Press-to-start prompt */}
        {screen.kind === "ready" && (
          <div
            data-testid="press-to-start-screen"
            className="pointer-events-none absolute inset-x-0 bottom-12 flex justify-center"
          >
            <p className="rounded-full bg-black/70 px-4 py-2 text-caption-md font-medium text-white">
              {t("pressToStart")}
            </p>
          </div>
        )}

        {/* Between-round overlay */}
        {screen.kind === "between-rounds" && (
          <div
            data-testid="between-round-screen"
            className="absolute inset-0 flex flex-col items-center justify-center gap-6 rounded-2xl bg-black/70"
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
            <div className="flex items-center gap-3">
              <Button variant="default" size="sm" onClick={handleNextRound}>
                {t("nextRound")}
              </Button>
              <Button variant="outline" size="sm" onClick={handleQuit}>
                {t("viewRanking")}
              </Button>
            </div>
          </div>
        )}

        {/* Round error overlay */}
        {screen.kind === "round-error" && (
          <div
            data-testid="round-error-screen"
            className="absolute inset-0 flex flex-col items-center justify-center gap-6 rounded-2xl bg-black/70"
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
            className="absolute inset-0 flex flex-col items-center justify-center gap-6 rounded-2xl bg-black/70"
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
    </div>
  );
}
