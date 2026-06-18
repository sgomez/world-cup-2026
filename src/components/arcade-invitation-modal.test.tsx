import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
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
          startError: "Could not start a run. Please try again.",
        }[key] ?? key
      );
    };
  }),
}));

const defaultProps = {
  hasPlayedToday: false,
  enabled: true,
  onPlay: vi.fn(),
  loading: false,
  error: false,
};

describe("ArcadeInvitationModal", () => {
  it("does not open the modal when feature flag is disabled", () => {
    render(<ArcadeInvitationModal {...defaultProps} enabled={false} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not open the modal when user has already played today", () => {
    render(<ArcadeInvitationModal {...defaultProps} hasPlayedToday={true} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the modal automatically when user has not played today", () => {
    render(<ArcadeInvitationModal {...defaultProps} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Play Penguin Run!")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Challenge yourself in today's Penguin Run. You get one shot per day — make it count!",
      ),
    ).toBeInTheDocument();
  });

  it("renders Play Now and Maybe Later buttons in the modal", () => {
    render(<ArcadeInvitationModal {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: "Play Now" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Maybe Later" }),
    ).toBeInTheDocument();
  });

  it("closes the modal when Maybe Later is clicked", async () => {
    render(<ArcadeInvitationModal {...defaultProps} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Maybe Later" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("calls onPlay and closes the modal when Play Now is clicked", async () => {
    const onPlay = vi.fn();
    render(<ArcadeInvitationModal {...defaultProps} onPlay={onPlay} />);

    await userEvent.click(screen.getByRole("button", { name: "Play Now" }));

    expect(onPlay).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the start error message when error prop is set", () => {
    render(<ArcadeInvitationModal {...defaultProps} error={true} />);
    expect(
      screen.getByText("Could not start a run. Please try again."),
    ).toBeInTheDocument();
  });
});
