import { describe, expect, it } from "vitest";
import {
  GAME_INITIAL_SPEED,
  GAME_MIN_GAP_SAFETY,
  GAME_OBSTACLE_WIDTH,
  GAME_SPEED_CAP,
} from "@/config/arcade";
import {
  computeMinGap,
  computeReach,
  type PlanInput,
  planNextGroup,
} from "./penguin-run-planner";

// ---------------------------------------------------------------------------
// Deterministic RNG — a simple LCG so tests are reproducible.
// ---------------------------------------------------------------------------

function makeSeededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0x100000000;
  };
}

// Physics constants from the game (kept in sync with penguin-run-game.tsx).
const JUMP_VELOCITY = 700; // absolute value, px/s
const GRAVITY = 1800; // px/s²

// ---------------------------------------------------------------------------
// Helper: airtime (shared formula for assertions)
// ---------------------------------------------------------------------------

function airtime(): number {
  return (2 * JUMP_VELOCITY) / GRAVITY;
}

// ---------------------------------------------------------------------------
// computeMinGap
// ---------------------------------------------------------------------------

describe("computeMinGap", () => {
  it("returns speed * airtime * SAFETY", () => {
    const speed = GAME_INITIAL_SPEED;
    const expected = speed * airtime() * GAME_MIN_GAP_SAFETY;
    expect(computeMinGap(speed)).toBeCloseTo(expected, 5);
  });

  it("scales with scroll speed", () => {
    const gapAtLow = computeMinGap(GAME_INITIAL_SPEED);
    const gapAtHigh = computeMinGap(GAME_SPEED_CAP);
    expect(gapAtHigh).toBeGreaterThan(gapAtLow);
  });
});

// ---------------------------------------------------------------------------
// computeReach
// ---------------------------------------------------------------------------

describe("computeReach", () => {
  it("returns speed * airtime", () => {
    const speed = GAME_INITIAL_SPEED;
    expect(computeReach(speed)).toBeCloseTo(speed * airtime(), 5);
  });

  it("scales with scroll speed", () => {
    expect(computeReach(GAME_SPEED_CAP)).toBeGreaterThan(
      computeReach(GAME_INITIAL_SPEED),
    );
  });
});

// ---------------------------------------------------------------------------
// planNextGroup — core invariants
// ---------------------------------------------------------------------------

describe("planNextGroup", () => {
  /**
   * Run `iterations` plans at given speed/elapsed and assert invariants on
   * every result.
   */
  function assertInvariants(
    opts: Omit<PlanInput, "rng">,
    iterations = 500,
  ): void {
    const rng = makeSeededRng(42);
    const { speed, elapsedMs } = opts;
    const minGap = computeMinGap(speed);
    const reach = computeReach(speed);

    for (let i = 0; i < iterations; i++) {
      const result = planNextGroup({ speed, elapsedMs, rng });

      // (1) gapPx is always >= minGap
      expect(result.gapPx).toBeGreaterThanOrEqual(minGap);

      // (2) group size within 1-3
      expect(result.size).toBeGreaterThanOrEqual(1);
      expect(result.size).toBeLessThanOrEqual(3);

      // (3) group span (size * obstacle-width) <= jump reach
      const span = result.size * GAME_OBSTACLE_WIDTH;
      expect(span).toBeLessThanOrEqual(reach);
    }
  }

  it("satisfies all invariants at initial speed (elapsed=0)", () => {
    assertInvariants({ speed: GAME_INITIAL_SPEED, elapsedMs: 0 });
  });

  it("satisfies all invariants at max speed (elapsed=0)", () => {
    assertInvariants({ speed: GAME_SPEED_CAP, elapsedMs: 0 });
  });

  it("satisfies all invariants at initial speed after 2 minutes", () => {
    assertInvariants({ speed: GAME_INITIAL_SPEED, elapsedMs: 120_000 });
  });

  it("satisfies all invariants at max speed after 2 minutes", () => {
    assertInvariants({ speed: GAME_SPEED_CAP, elapsedMs: 120_000 });
  });

  it("satisfies all invariants at mid-range speed mid-game", () => {
    assertInvariants({ speed: 550, elapsedMs: 60_000 });
  });

  // -------------------------------------------------------------------------
  // gapPx invariant — detailed
  // -------------------------------------------------------------------------

  it("gapPx >= minGap(speed) for every call", () => {
    const rng = makeSeededRng(99);
    for (const speed of [GAME_INITIAL_SPEED, 500, GAME_SPEED_CAP]) {
      for (const elapsedMs of [0, 30_000, 120_000]) {
        const minGap = computeMinGap(speed);
        for (let i = 0; i < 200; i++) {
          const { gapPx } = planNextGroup({ speed, elapsedMs, rng });
          expect(gapPx).toBeGreaterThanOrEqual(minGap);
        }
      }
    }
  });

  // -------------------------------------------------------------------------
  // Size distribution skews heavier over time
  // -------------------------------------------------------------------------

  it("average group size increases as elapsed time grows", () => {
    const iterations = 2000;

    function averageSize(elapsedMs: number): number {
      const rng = makeSeededRng(7);
      let total = 0;
      for (let i = 0; i < iterations; i++) {
        total += planNextGroup({
          speed: GAME_INITIAL_SPEED,
          elapsedMs,
          rng,
        }).size;
      }
      return total / iterations;
    }

    const earlyAvg = averageSize(0);
    const lateAvg = averageSize(120_000);

    // Later runs should skew toward larger groups
    expect(lateAvg).toBeGreaterThan(earlyAvg);
  });

  it("early distribution skews toward size 1", () => {
    const rng = makeSeededRng(11);
    const counts = [0, 0, 0]; // index 0 = size 1, etc.
    for (let i = 0; i < 2000; i++) {
      const { size } = planNextGroup({
        speed: GAME_INITIAL_SPEED,
        elapsedMs: 0,
        rng,
      });
      counts[size - 1]++;
    }
    // Size 1 should be most common early on
    expect(counts[0]).toBeGreaterThan(counts[1]);
    expect(counts[0]).toBeGreaterThan(counts[2]);
  });

  it("late distribution is more balanced / skews away from size 1", () => {
    const rng = makeSeededRng(13);
    const earlySize1Count = (() => {
      let n = 0;
      const r = makeSeededRng(13);
      for (let i = 0; i < 2000; i++) {
        if (
          planNextGroup({ speed: GAME_INITIAL_SPEED, elapsedMs: 0, rng: r })
            .size === 1
        )
          n++;
      }
      return n;
    })();

    const lateSize1Count = (() => {
      let n = 0;
      const r = makeSeededRng(13);
      for (let i = 0; i < 2000; i++) {
        if (
          planNextGroup({
            speed: GAME_INITIAL_SPEED,
            elapsedMs: 120_000,
            rng: r,
          }).size === 1
        )
          n++;
      }
      return n;
    })();

    // Late game should have fewer size-1 groups than early game
    expect(lateSize1Count).toBeLessThan(earlySize1Count);
  });

  // -------------------------------------------------------------------------
  // extraRange floor — gap never collapses to zero slack
  // -------------------------------------------------------------------------

  it("gapPx is strictly greater than minGap for at least some results (non-zero slack)", () => {
    const rng = makeSeededRng(17);
    let anyAbove = false;
    for (let i = 0; i < 500; i++) {
      const { gapPx } = planNextGroup({
        speed: GAME_INITIAL_SPEED,
        elapsedMs: 999_999, // far future — shrunk extra range
        rng,
      });
      const minGap = computeMinGap(GAME_INITIAL_SPEED);
      if (gapPx > minGap) anyAbove = true;
    }
    expect(anyAbove).toBe(true);
  });

  // -------------------------------------------------------------------------
  // RNG injection — no Math.random in planner
  // -------------------------------------------------------------------------

  it("produces identical output for the same seeded RNG", () => {
    const result1 = planNextGroup({
      speed: GAME_INITIAL_SPEED,
      elapsedMs: 0,
      rng: makeSeededRng(42),
    });
    const result2 = planNextGroup({
      speed: GAME_INITIAL_SPEED,
      elapsedMs: 0,
      rng: makeSeededRng(42),
    });
    expect(result1).toEqual(result2);
  });
});
