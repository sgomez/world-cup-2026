import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: vi.fn((namespace) => {
    return (key: string, values?: Record<string, unknown>) => {
      if (namespace === "bets") {
        if (key === "createdLabel") return `Created ${values?.date}`;
        if (key === "updatedLabel") return `Updated ${values?.date}`;
        return (
          {
            noBets: "No bets yet.",
            draft: "Draft",
            closed: "Closed",
            signature: "Signature",
            copy: "Copy",
            removeBetAriaLabel: "Remove bet",
            removeDialogTitle: "Remove bet?",
            removeDialogDescription: "Are you sure?",
            cancel: "Cancel",
            removing: "Removing…",
            remove: "Remove",
          }[key] ?? key
        );
      }
      return key;
    };
  }),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    className,
    onClick,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
    onClick?: React.MouseEventHandler;
  }) => (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/copy-bet-button", () => ({
  CopyBetButton: ({ betId }: { betId: string }) => (
    <button type="button" data-testid={`copy-${betId}`}>
      Copy
    </button>
  ),
}));

vi.mock("@/components/remove-bet-button", () => ({
  RemoveBetButton: ({
    betId,
    onRemoved,
  }: {
    betId: string;
    onRemoved: () => void;
  }) => (
    <button type="button" data-testid={`remove-${betId}`} onClick={onRemoved}>
      Remove
    </button>
  ),
}));

import type React from "react";
import { BetList } from "./bet-list";

const baseBet = {
  id: "bet-1",
  label: "Spain wins it all",
  status: "draft" as const,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-02"),
  userId: "user-1",
  groupPredictions: null,
  knockoutWinners: null,
  signature: undefined,
};

const closedBet = {
  ...baseBet,
  id: "bet-2",
  label: "Brazil all the way",
  status: "closed" as const,
  signature: "abc123def456",
};

describe("BetList", () => {
  describe("empty state", () => {
    it("shows empty state when no bets", () => {
      render(
        <BetList bets={[]} deadlinePassed={false} showCopyButtons={false} />,
      );
      expect(screen.getByText("No bets yet.")).toBeInTheDocument();
    });
  });

  describe("signature block", () => {
    it("shows signature block only for closed bets", () => {
      render(
        <BetList
          bets={[baseBet, closedBet]}
          deadlinePassed={false}
          showCopyButtons={false}
        />,
      );
      expect(screen.getByText("Signature")).toBeInTheDocument();
      expect(screen.getByText("abc123de")).toBeInTheDocument();
    });

    it("does not show signature block for draft bets", () => {
      render(
        <BetList
          bets={[baseBet]}
          deadlinePassed={false}
          showCopyButtons={false}
        />,
      );
      expect(screen.queryByText("Signature")).not.toBeInTheDocument();
    });

    it("does not show verified/invalid badge on signature", () => {
      render(
        <BetList
          bets={[closedBet]}
          deadlinePassed={false}
          showCopyButtons={false}
        />,
      );
      expect(screen.queryByText("Verified")).not.toBeInTheDocument();
      expect(screen.queryByText("Invalid")).not.toBeInTheDocument();
      expect(screen.queryByText(/verificad/i)).not.toBeInTheDocument();
    });
  });

  describe("row navigation and button isolation", () => {
    it("each bet row is wrapped in a link to /bets/[id]", () => {
      render(
        <BetList
          bets={[baseBet]}
          deadlinePassed={false}
          showCopyButtons={false}
        />,
      );
      const link = screen.getByRole("link", { name: /spain wins it all/i });
      expect(link).toHaveAttribute("href", "/bets/bet-1");
    });

    it("copy button click does not propagate to the link", async () => {
      const user = userEvent.setup();
      render(
        <BetList
          bets={[baseBet]}
          deadlinePassed={false}
          showCopyButtons={true}
        />,
      );
      const copyBtn = screen.getByTestId("copy-bet-1");
      const linkEl = screen.getByRole("link", { name: /spain wins it all/i });

      const linkClick = vi.fn();
      linkEl.addEventListener("click", linkClick);

      await user.click(copyBtn);
      expect(linkClick).not.toHaveBeenCalled();
    });

    it("remove button click does not propagate to the link", async () => {
      const user = userEvent.setup();
      render(
        <BetList
          bets={[baseBet]}
          deadlinePassed={false}
          showCopyButtons={false}
        />,
      );
      const removeBtn = screen.getByTestId("remove-bet-1");
      const linkEl = screen.getByRole("link", { name: /spain wins it all/i });

      const linkClick = vi.fn();
      linkEl.addEventListener("click", linkClick);

      await user.click(removeBtn);
      expect(linkClick).not.toHaveBeenCalled();
    });
  });

  describe("status badges", () => {
    it("shows Draft badge for draft bets", () => {
      render(
        <BetList
          bets={[baseBet]}
          deadlinePassed={false}
          showCopyButtons={false}
        />,
      );
      expect(screen.getByText("Draft")).toBeInTheDocument();
    });

    it("shows Closed badge for closed bets", () => {
      render(
        <BetList
          bets={[closedBet]}
          deadlinePassed={false}
          showCopyButtons={false}
        />,
      );
      expect(screen.getByText("Closed")).toBeInTheDocument();
    });
  });
});
