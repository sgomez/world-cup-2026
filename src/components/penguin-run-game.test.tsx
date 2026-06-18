import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PenguinRunGame } from "./penguin-run-game";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("next-intl", () => ({
  useTranslations: vi.fn((_namespace: string) => {
    return (key: string) => {
      return (
        (
          {
            round: "Round",
            life: "Life",
            livesRemaining: "# lives remaining",
            bestScore: "Best score",
            roundScore: "Round score",
            nextRound: "Next Round",
            viewRanking: "View Ranking",
            roundError: "Could not record round. Please try again.",
            retryRound: "Retry",
            runFinished: "Run finished",
          } as Record<string, string>
        )[key] ?? key
      );
    };
  }),
}));

// Canvas API is not available in happy-dom — mock it minimally.
HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  fillText: vi.fn(),
  measureText: vi.fn().mockReturnValue({ width: 20 }),
  save: vi.fn(),
  restore: vi.fn(),
  beginPath: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  set font(_v: string) {},
  set fillStyle(_v: string) {},
  set textAlign(_v: string) {},
  set textBaseline(_v: string) {},
});

// requestAnimationFrame — queue but never auto-execute, so the game loop
// does not run autonomously during tests. Tests trigger collisions via the
// custom DOM event instead of advancing the physics loop.
global.requestAnimationFrame = vi.fn((_cb: FrameRequestCallback) => 0);
global.cancelAnimationFrame = vi.fn();

const mockFetch = vi.fn();
global.fetch = mockFetch;

// Default fetch stub: return a resolved response object.
function stubFetchOk(json: unknown = {}) {
  return { ok: true, status: 200, json: async () => json };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface GameProps {
  runId?: string;
  onFinished?: () => void;
}

function renderGame({ runId = "run-1", onFinished = vi.fn() }: GameProps = {}) {
  return render(<PenguinRunGame runId={runId} onFinished={onFinished} />);
}

/** Dispatch the test-only collision event on the canvas. */
function triggerCollision() {
  const canvas = screen.getByTestId("penguin-run-canvas");
  act(() => {
    canvas.dispatchEvent(
      new CustomEvent("__test_collision__", { bubbles: false }),
    );
  });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers();
  mockFetch.mockReset();
  // Default: all fetches succeed silently (covers ping heartbeat)
  mockFetch.mockResolvedValue(stubFetchOk());
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PenguinRunGame", () => {
  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  it("mounts as a full-screen overlay covering the page", () => {
    renderGame();
    const overlay = screen.getByTestId("penguin-run-overlay");
    expect(overlay).toBeInTheDocument();
    expect(overlay.className).toMatch(/fixed/);
    expect(overlay.className).toMatch(/inset-0/);
  });

  it("renders a canvas element inside the overlay", () => {
    renderGame();
    const canvas = screen.getByTestId("penguin-run-canvas");
    expect(canvas.tagName).toBe("CANVAS");
  });

  it("starts in playing phase — no between-round or game-over overlay visible", () => {
    renderGame();
    expect(
      screen.queryByTestId("between-round-screen"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("game-over-screen")).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Between-round screen (after a collision)
  // -------------------------------------------------------------------------

  it("shows between-round screen after a collision and /api/arcade/round succeeds", async () => {
    mockFetch.mockResolvedValueOnce(
      stubFetchOk({
        id: "run-1",
        status: "in_progress",
        bestScore: 5,
        roundsPlayed: 1,
      }),
    );

    renderGame();
    triggerCollision();

    await act(async () => {
      await Promise.resolve(); // flush microtasks
    });

    expect(screen.getByTestId("between-round-screen")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Next Round" }),
    ).toBeInTheDocument();
  });

  it("calls POST /api/arcade/round with correct payload after collision", async () => {
    mockFetch.mockResolvedValueOnce(
      stubFetchOk({
        id: "run-1",
        status: "in_progress",
        bestScore: 3,
        roundsPlayed: 1,
      }),
    );

    renderGame({ runId: "run-abc" });
    triggerCollision();

    await act(async () => {
      await Promise.resolve();
    });

    const roundCall = mockFetch.mock.calls.find(
      ([url]) => url === "/api/arcade/round",
    );
    expect(roundCall).toBeDefined();

    const body = JSON.parse((roundCall![1] as RequestInit).body as string);
    expect(body).toHaveProperty("runId", "run-abc");
    expect(body).toHaveProperty("roundStartedAt");
    expect(body).toHaveProperty("reportedScore");
    expect(typeof body.reportedScore).toBe("number");
  });

  it("shows error message and Retry button when /api/arcade/round fails", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    renderGame();
    triggerCollision();

    await act(async () => {
      await Promise.resolve();
    });

    expect(
      screen.getByText("Could not record round. Please try again."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Next Round starts new round with reset score
  // -------------------------------------------------------------------------

  it("starts next round when Next Round button is clicked", async () => {
    mockFetch.mockResolvedValueOnce(
      stubFetchOk({
        id: "run-1",
        status: "in_progress",
        bestScore: 10,
        roundsPlayed: 1,
      }),
    );

    renderGame();
    triggerCollision();

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId("between-round-screen")).toBeInTheDocument();

    await act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Next Round" }));
    });

    expect(
      screen.queryByTestId("between-round-screen"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("game-over-screen")).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Game-over after three rounds
  // -------------------------------------------------------------------------

  it("shows game-over screen and calls /api/arcade/finish after third round collision", async () => {
    // Round 1
    mockFetch.mockResolvedValueOnce(
      stubFetchOk({
        id: "run-1",
        status: "in_progress",
        bestScore: 5,
        roundsPlayed: 1,
      }),
    );
    // Round 2
    mockFetch.mockResolvedValueOnce(
      stubFetchOk({
        id: "run-1",
        status: "in_progress",
        bestScore: 7,
        roundsPlayed: 2,
      }),
    );
    // Round 3 — server transitions to finished
    mockFetch.mockResolvedValueOnce(
      stubFetchOk({
        id: "run-1",
        status: "finished",
        bestScore: 7,
        roundsPlayed: 3,
      }),
    );
    // finish call
    mockFetch.mockResolvedValueOnce(stubFetchOk());

    renderGame();

    // Collision 1
    triggerCollision();
    await act(async () => {
      await Promise.resolve();
    });
    await act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Next Round" }));
    });

    // Collision 2
    triggerCollision();
    await act(async () => {
      await Promise.resolve();
    });
    await act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Next Round" }));
    });

    // Collision 3
    triggerCollision();
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId("game-over-screen")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "View Ranking" }),
    ).toBeInTheDocument();

    const finishCall = mockFetch.mock.calls.find(
      ([url]) => url === "/api/arcade/finish",
    );
    expect(finishCall).toBeDefined();
    const finishBody = JSON.parse(
      (finishCall![1] as RequestInit).body as string,
    );
    expect(finishBody).toHaveProperty("runId", "run-1");
  });

  it("fires onFinished when View Ranking is clicked on game-over screen", async () => {
    const onFinished = vi.fn();

    // 3 rounds + finish
    mockFetch
      .mockResolvedValueOnce(
        stubFetchOk({
          id: "run-1",
          status: "in_progress",
          bestScore: 3,
          roundsPlayed: 1,
        }),
      )
      .mockResolvedValueOnce(
        stubFetchOk({
          id: "run-1",
          status: "in_progress",
          bestScore: 3,
          roundsPlayed: 2,
        }),
      )
      .mockResolvedValueOnce(
        stubFetchOk({
          id: "run-1",
          status: "finished",
          bestScore: 3,
          roundsPlayed: 3,
        }),
      )
      .mockResolvedValueOnce(stubFetchOk());

    renderGame({ onFinished });

    for (let i = 0; i < 2; i++) {
      triggerCollision();
      await act(async () => {
        await Promise.resolve();
      });
      await act(() => {
        fireEvent.click(screen.getByRole("button", { name: "Next Round" }));
      });
    }

    triggerCollision();
    await act(async () => {
      await Promise.resolve();
    });

    await act(() => {
      fireEvent.click(screen.getByRole("button", { name: "View Ranking" }));
    });
    expect(onFinished).toHaveBeenCalledOnce();
  });

  // -------------------------------------------------------------------------
  // Heartbeat
  // -------------------------------------------------------------------------

  it("sends a heartbeat ping every 30 seconds while playing", async () => {
    renderGame({ runId: "run-hb" });

    // Advance 30 seconds to trigger the first interval tick
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    const pingCalls = mockFetch.mock.calls.filter(
      ([url]) => url === "/api/arcade/ping",
    );
    expect(pingCalls.length).toBeGreaterThanOrEqual(1);
    const pingBody = JSON.parse(
      (pingCalls[0][1] as RequestInit).body as string,
    );
    expect(pingBody).toHaveProperty("runId", "run-hb");
  });

  it("does not call onFinished when a heartbeat ping fails", async () => {
    const onFinished = vi.fn();
    // Make only the ping call fail; other calls are irrelevant
    mockFetch.mockImplementation((url: string) => {
      if (url === "/api/arcade/ping") {
        return Promise.reject(new Error("network error"));
      }
      return Promise.resolve(stubFetchOk());
    });

    renderGame({ onFinished });

    await act(async () => {
      vi.advanceTimersByTime(30_000);
      await Promise.resolve();
    });

    expect(onFinished).not.toHaveBeenCalled();
    expect(screen.queryByTestId("game-over-screen")).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Jump controls
  // -------------------------------------------------------------------------

  it("does not scroll the page when Space is pressed during gameplay", () => {
    renderGame();

    const event = new KeyboardEvent("keydown", { key: " ", bubbles: true });
    const preventDefaultSpy = vi.spyOn(event, "preventDefault");

    window.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
  });
});
