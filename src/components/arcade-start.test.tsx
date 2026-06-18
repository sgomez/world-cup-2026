import { render, screen } from "@testing-library/react";
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

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const onPlay = vi.fn();

beforeEach(() => {
  onPlay.mockReset();
});

// ---------------------------------------------------------------------------
// Tests — ArcadeStart is presentational; the parent owns the run lifecycle.
// ---------------------------------------------------------------------------

describe("ArcadeStart", () => {
  it("renders a disabled Play button when the feature flag is off", async () => {
    render(<ArcadeStart enabled={false} status="idle" onPlay={onPlay} />);

    const btn = screen.getByRole("button", { name: "Play Penguin Run" });
    expect(btn).toBeDisabled();

    await userEvent.click(btn);
    expect(onPlay).not.toHaveBeenCalled();
  });

  it("calls onPlay when the Play button is clicked", async () => {
    render(<ArcadeStart enabled={true} status="idle" onPlay={onPlay} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Play Penguin Run" }),
    );
    expect(onPlay).toHaveBeenCalledOnce();
  });

  it("shows loading text and disables the button while loading", () => {
    render(<ArcadeStart enabled={true} status="loading" onPlay={onPlay} />);

    expect(screen.getByText("Starting…")).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("shows 'Already played today' for the already_played status", () => {
    render(
      <ArcadeStart enabled={true} status="already_played" onPlay={onPlay} />,
    );

    expect(screen.getByText("Already played today")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Play Penguin Run" }),
    ).not.toBeInTheDocument();
  });

  it("shows an error message and a retry button for the error status", async () => {
    render(<ArcadeStart enabled={true} status="error" onPlay={onPlay} />);

    expect(
      screen.getByText("Could not start a run. Please try again."),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Play Penguin Run" }),
    );
    expect(onPlay).toHaveBeenCalledOnce();
  });
});
