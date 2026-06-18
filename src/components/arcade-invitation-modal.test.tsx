import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArcadeInvitationModal } from "./arcade-invitation-modal";

vi.mock("next-intl", () => ({
  useTranslations: vi.fn((_namespace) => {
    return (key: string) => {
      return (
        {
          invitationModalTitle: "Play Penguin Run!",
          invitationModalDescription:
            "Challenge yourself in today's Penguin Run. You get one shot per day — make it count!",
          playNow: "Play Now",
          maybeLater: "Maybe Later",
          playButton: "Play Penguin Run",
          starting: "Starting…",
          startError: "Could not start a run. Please try again.",
          alreadyPlayedToday: "Already played today",
          resetsAt: "Resets at 00:00 UTC",
        }[key] ?? key
      );
    };
  }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("ArcadeInvitationModal", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("does not open the modal when user has already played today", () => {
    render(<ArcadeInvitationModal hasPlayedToday={true} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the modal automatically when user has not played today", () => {
    render(<ArcadeInvitationModal hasPlayedToday={false} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Play Penguin Run!")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Challenge yourself in today's Penguin Run. You get one shot per day — make it count!",
      ),
    ).toBeInTheDocument();
  });

  it("renders Play Now and Maybe Later buttons in the modal", () => {
    render(<ArcadeInvitationModal hasPlayedToday={false} />);
    expect(
      screen.getByRole("button", { name: "Play Now" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Maybe Later" }),
    ).toBeInTheDocument();
  });

  it("closes the modal when Maybe Later is clicked", async () => {
    render(<ArcadeInvitationModal hasPlayedToday={false} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Maybe Later" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("calls POST /api/arcade/start and closes modal on Play Now click (success)", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 201,
      json: async () => ({ id: "run-1", playDay: "2026-06-18" }),
    });

    render(<ArcadeInvitationModal hasPlayedToday={false} />);

    await userEvent.click(screen.getByRole("button", { name: "Play Now" }));

    expect(mockFetch).toHaveBeenCalledWith("/api/arcade/start", {
      method: "POST",
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows error state when start fails and keeps modal open", async () => {
    mockFetch.mockResolvedValueOnce({ status: 500 });

    render(<ArcadeInvitationModal hasPlayedToday={false} />);

    await userEvent.click(screen.getByRole("button", { name: "Play Now" }));

    expect(
      screen.getByText("Could not start a run. Please try again."),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("handles 409 (already played) response and closes the modal", async () => {
    mockFetch.mockResolvedValueOnce({ status: 409 });

    render(<ArcadeInvitationModal hasPlayedToday={false} />);

    await userEvent.click(screen.getByRole("button", { name: "Play Now" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
