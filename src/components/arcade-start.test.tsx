import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArcadeStart } from "./arcade-start";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("next-intl", () => ({
  useTranslations: vi.fn((_namespace: string) => {
    return (key: string) => {
      return (
        (
          {
            playButton: "Play Penguin Run",
            starting: "Starting…",
            startError: "Could not start a run. Please try again.",
            alreadyPlayedToday: "Already played today",
            resetsAt: "Resets at 00:00 UTC",
          } as Record<string, string>
        )[key] ?? key
      );
    };
  }),
}));

// Mock PenguinRunGame so ArcadeStart tests don't need a canvas environment.
// The mock captures the onFinished callback so tests can invoke it directly.
let capturedOnFinished: (() => void) | undefined;

vi.mock("./penguin-run-game", () => ({
  PenguinRunGame: ({
    runId,
    onFinished,
  }: {
    runId: string;
    onFinished: () => void;
  }) => {
    capturedOnFinished = onFinished;
    return (
      <div data-testid="penguin-run-game" data-run-id={runId}>
        PenguinRunGame mock
      </div>
    );
  },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockFetch.mockReset();
  capturedOnFinished = undefined;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ArcadeStart", () => {
  // -------------------------------------------------------------------------
  // Feature flag disabled
  // -------------------------------------------------------------------------

  it("renders a disabled Play button when ARCADE_GAME_ENABLED flag is false", () => {
    render(<ArcadeStart hasPlayedToday={false} enabled={false} />);

    const btn = screen.getByRole("button", { name: "Play Penguin Run" });
    expect(btn).toBeDisabled();
  });

  it("does not call /api/arcade/start when the flag is disabled", async () => {
    render(<ArcadeStart hasPlayedToday={false} enabled={false} />);

    const btn = screen.getByRole("button", { name: "Play Penguin Run" });
    // Click is a no-op because the button is disabled
    await userEvent.click(btn);

    expect(mockFetch).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Already played today
  // -------------------------------------------------------------------------

  it("shows 'Already played today' when hasPlayedToday is true", () => {
    render(<ArcadeStart hasPlayedToday={true} enabled={true} />);
    expect(screen.getByText("Already played today")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Play Penguin Run" }),
    ).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Successful start → mounts PenguinRunGame
  // -------------------------------------------------------------------------

  it("mounts PenguinRunGame with the runId when /api/arcade/start returns 201", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 201,
      json: async () => ({ id: "run-test-1", playDay: "2026-06-18" }),
    });

    render(<ArcadeStart hasPlayedToday={false} enabled={true} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Play Penguin Run" }),
    );

    expect(mockFetch).toHaveBeenCalledWith("/api/arcade/start", {
      method: "POST",
    });

    const game = screen.getByTestId("penguin-run-game");
    expect(game).toBeInTheDocument();
    expect(game).toHaveAttribute("data-run-id", "run-test-1");
  });

  it("does not render PenguinRunGame before the Play button is clicked", () => {
    render(<ArcadeStart hasPlayedToday={false} enabled={true} />);
    expect(screen.queryByTestId("penguin-run-game")).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // onFinished → transitions to already_played
  // -------------------------------------------------------------------------

  it("transitions to 'Already played today' when PenguinRunGame fires onFinished", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 201,
      json: async () => ({ id: "run-test-2", playDay: "2026-06-18" }),
    });

    render(<ArcadeStart hasPlayedToday={false} enabled={true} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Play Penguin Run" }),
    );

    // Game is now mounted
    expect(screen.getByTestId("penguin-run-game")).toBeInTheDocument();

    // Fire the onFinished callback — wrapped in act because it triggers a React state update
    act(() => {
      capturedOnFinished?.();
    });

    expect(screen.queryByTestId("penguin-run-game")).not.toBeInTheDocument();
    expect(screen.getByText("Already played today")).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------

  it("shows an error message when /api/arcade/start returns a non-201 status", async () => {
    mockFetch.mockResolvedValueOnce({ status: 500 });

    render(<ArcadeStart hasPlayedToday={false} enabled={true} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Play Penguin Run" }),
    );

    expect(
      screen.getByText("Could not start a run. Please try again."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("penguin-run-game")).not.toBeInTheDocument();
  });

  it("shows an error message when fetch throws (network failure)", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network"));

    render(<ArcadeStart hasPlayedToday={false} enabled={true} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Play Penguin Run" }),
    );

    expect(
      screen.getByText("Could not start a run. Please try again."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("penguin-run-game")).not.toBeInTheDocument();
  });

  it("shows 'Already played today' when /api/arcade/start returns 409", async () => {
    mockFetch.mockResolvedValueOnce({ status: 409 });

    render(<ArcadeStart hasPlayedToday={false} enabled={true} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Play Penguin Run" }),
    );

    expect(screen.getByText("Already played today")).toBeInTheDocument();
    expect(screen.queryByTestId("penguin-run-game")).not.toBeInTheDocument();
  });

  it("shows loading text while /api/arcade/start is in flight", async () => {
    // Never resolves — keeps component in loading state
    mockFetch.mockReturnValueOnce(new Promise(() => {}));

    render(<ArcadeStart hasPlayedToday={false} enabled={true} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Play Penguin Run" }),
    );

    expect(screen.getByText("Starting…")).toBeInTheDocument();
  });
});
