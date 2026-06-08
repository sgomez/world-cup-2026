import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CommunityDetail } from "./community-detail";

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: vi.fn((namespace) => {
    return (key: string, values?: Record<string, unknown>) => {
      if (namespace === "communities") {
        return (
          {
            ownerLabel: `Owner: ${values?.name}`,
            inviteLink: "Invite link",
            manageCommunity: "Manage community",
            members: `Members (${values?.count})`,
            noBets: "No bets.",
            backToCommunities: "Back to Communities",
            betsTitle: "Bets",
            draft: "Draft",
            closed: "Closed",
            signature: "Sig",
            owner: "Owner",
            member: "Member",
            you: "You",
            view: "View",
          }[key] ?? key
        );
      }
      return key;
    };
  }),
}));

// Mock Link from navigation
vi.mock("@/i18n/navigation", () => ({
  Link: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className} data-testid="nav-link">
      {children}
    </a>
  ),
}));

// Mock other components
vi.mock("@/components/copy-invite-link-button", () => ({
  CopyInviteLinkButton: () => <button type="button">Copy</button>,
}));
vi.mock("@/components/leave-community-form", () => ({
  LeaveCommunityForm: () => <button type="button">Leave</button>,
}));

describe("CommunityDetail", () => {
  const mockCommunity = {
    id: "community-1",
    name: "Test Community",
    slug: "test-community",
    ownerId: "user-1",
    owner: { name: "Owner Name" },
    inviteToken: "invite-token-123",
    currentUserId: "user-1",
    members: [
      {
        userId: "user-1",
        joinedAt: new Date(),
        user: {
          id: "user-1",
          name: "User One",
          bets: [
            {
              id: "bet-1",
              label: "My Closed Bet",
              status: "closed",
              signature: "sig-123",
            },
            { id: "bet-draft-1", label: "My Draft Bet", status: "draft" },
          ],
        },
      },
      {
        userId: "user-2",
        joinedAt: new Date(),
        user: {
          id: "user-2",
          name: "User Two",
          bets: [{ id: "bet-2", label: "Peer Closed Bet", status: "closed" }],
        },
      },
    ],
  };

  it("renders (YOU) chip on the current user's header only", () => {
    render(
      <CommunityDetail community={mockCommunity} inviteUrl="http://invite" />,
    );

    // Header elements for each member should contain their name
    const userOneHeaders = screen.getAllByText("User One");
    expect(userOneHeaders.length).toBeGreaterThan(0);

    // Look for the "You" chip. The header is expected to display "User One" and a "You" chip.
    // We expect "You" to be present in User One's section header container.
    const youChips = screen.queryAllByText("You");
    expect(youChips.length).toBe(1);

    // Let's ensure the "You" chip is indeed in the same container as the User One heading.
    const userOneHeaderContainer = userOneHeaders[
      userOneHeaders.length - 1
    ].closest("div") as HTMLElement;
    expect(within(userOneHeaderContainer).getByText("You")).toBeInTheDocument();

    // User Two is not the current user, so they should not have the "You" chip in their header.
    const userTwoHeaders = screen.getAllByText("User Two");
    const userTwoHeaderContainer = userTwoHeaders[
      userTwoHeaders.length - 1
    ].closest("div") as HTMLElement;
    expect(within(userTwoHeaderContainer).queryByText("You")).toBeNull();
  });

  it("hides draft rows completely", () => {
    render(
      <CommunityDetail community={mockCommunity} inviteUrl="http://invite" />,
    );

    // Draft bet should not be rendered
    expect(screen.queryByText("My Draft Bet")).toBeNull();
  });

  it("renders view button for each visible bet row with correct link destinations", () => {
    render(
      <CommunityDetail community={mockCommunity} inviteUrl="http://invite" />,
    );

    // Active/visible bets are "My Closed Bet" and "Peer Closed Bet"
    const myBetLink = screen.getByText("My Closed Bet");
    const peerBetLink = screen.getByText("Peer Closed Bet");

    // Get the parent containers of the bet rows
    const myBetRow = myBetLink.closest(".bg-card") as HTMLElement;
    const peerBetRow = peerBetLink.closest(".bg-card") as HTMLElement;

    // Each row must have a View button
    const myViewBtn = within(myBetRow).getByText("View");
    const peerViewBtn = within(peerBetRow).getByText("View");

    expect(myViewBtn).toBeInTheDocument();
    expect(peerViewBtn).toBeInTheDocument();

    // Check link destinations
    expect(myViewBtn.closest("a")).toHaveAttribute("href", "/bets/bet-1");
    expect(peerViewBtn.closest("a")).toHaveAttribute(
      "href",
      "/communities/test-community/bets/bet-2",
    );
  });

  it("preserves existing status and signature chips", () => {
    render(
      <CommunityDetail community={mockCommunity} inviteUrl="http://invite" />,
    );

    const myBetLink = screen.getByText("My Closed Bet");
    const myBetRow = myBetLink.closest(".bg-card") as HTMLElement;

    // "Closed" status chip should be present
    expect(within(myBetRow).getByText("Closed")).toBeInTheDocument();

    // Signature prefix should be present ("sig-123" -> check if "sig-123" or "sig-123".slice(0, 8) is shown)
    expect(
      within(myBetRow).getByText("sig-123".slice(0, 8)),
    ).toBeInTheDocument();
  });
});
