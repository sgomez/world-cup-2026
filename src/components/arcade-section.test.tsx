import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArcadeSection } from "./arcade-section";

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
            invitationModalTitle: "Play Penguin Run!",
            invitationModalDescription: "Challenge yourself today.",
            playNow: "Play Now",
            maybeLater: "Maybe Later",
          } as Record<string, string>
        )[key] ?? key
      );
    };
  }),
}));

// Mock PenguinRunGame so the section tests don't need a canvas environment.
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

beforeEach(() => {
  mockFetch.mockReset();
  capturedOnFinished = undefined;
});

/**
 * Close the auto-opened invitation modal so the page Play button is exposed to
 * the accessibility tree (base-ui marks background content inert while open).
 */
async function dismissModal() {
  await userEvent.click(screen.getByRole("button", { name: "Maybe Later" }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ArcadeSection", () => {
  it("renders a disabled Play button and does not call the API when disabled", async () => {
    render(<ArcadeSection hasPlayedToday={false} enabled={false} />);

    const btn = screen.getByRole("button", { name: "Play Penguin Run" });
    expect(btn).toBeDisabled();
    await userEvent.click(btn);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("starts a run and mounts the game when the page Play button is clicked", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 201,
      json: async () => ({ id: "run-page", playDay: "2026-06-18" }),
    });

    render(<ArcadeSection hasPlayedToday={false} enabled={true} />);

    await dismissModal();
    await userEvent.click(
      screen.getByRole("button", { name: "Play Penguin Run" }),
    );

    expect(mockFetch).toHaveBeenCalledWith("/api/arcade/start", {
      method: "POST",
    });
    const game = screen.getByTestId("penguin-run-game");
    expect(game).toHaveAttribute("data-run-id", "run-page");
  });

  // Regression for #366 — pressing Play in the invitation modal previously
  // started a run server-side but never mounted the game.
  it("starts a run and mounts the game when the modal Play Now is clicked", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 201,
      json: async () => ({ id: "run-modal", playDay: "2026-06-18" }),
    });

    render(<ArcadeSection hasPlayedToday={false} enabled={true} />);

    // Modal auto-opens; click its Play Now.
    await userEvent.click(screen.getByRole("button", { name: "Play Now" }));

    expect(mockFetch).toHaveBeenCalledWith("/api/arcade/start", {
      method: "POST",
    });
    const game = screen.getByTestId("penguin-run-game");
    expect(game).toHaveAttribute("data-run-id", "run-modal");
  });

  it("transitions to 'Already played today' when the game fires onFinished", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 201,
      json: async () => ({ id: "run-fin", playDay: "2026-06-18" }),
    });

    render(<ArcadeSection hasPlayedToday={false} enabled={true} />);

    await dismissModal();
    await userEvent.click(
      screen.getByRole("button", { name: "Play Penguin Run" }),
    );
    expect(screen.getByTestId("penguin-run-game")).toBeInTheDocument();

    act(() => {
      capturedOnFinished?.();
    });

    expect(screen.queryByTestId("penguin-run-game")).not.toBeInTheDocument();
    expect(screen.getByText("Already played today")).toBeInTheDocument();
  });

  it("shows 'Already played today' when start returns 409", async () => {
    mockFetch.mockResolvedValueOnce({ status: 409 });

    render(<ArcadeSection hasPlayedToday={false} enabled={true} />);

    await dismissModal();
    await userEvent.click(
      screen.getByRole("button", { name: "Play Penguin Run" }),
    );

    expect(screen.getByText("Already played today")).toBeInTheDocument();
    expect(screen.queryByTestId("penguin-run-game")).not.toBeInTheDocument();
  });

  it("shows an error when start fails", async () => {
    mockFetch.mockResolvedValueOnce({ status: 500 });

    render(<ArcadeSection hasPlayedToday={false} enabled={true} />);

    await dismissModal();
    await userEvent.click(
      screen.getByRole("button", { name: "Play Penguin Run" }),
    );

    expect(
      screen.getByText("Could not start a run. Please try again."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("penguin-run-game")).not.toBeInTheDocument();
  });

  it("starts in the already_played state when the user has already played", () => {
    render(<ArcadeSection hasPlayedToday={true} enabled={true} />);

    expect(screen.getByText("Already played today")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
