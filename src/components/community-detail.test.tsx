import { render, screen } from "@testing-library/react";
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
            viewLeaderboard: "View Leaderboard",
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

// Mock CopyShareLinkButton
vi.mock("@/components/copy-share-link-button", () => ({
  CopyShareLinkButton: ({ url }: { url: string }) => (
    <button type="button" data-share-url={url}>
      Share
    </button>
  ),
}));

describe("CommunityDetail", () => {
  const mockCommunity = {
    id: "community-1",
    name: "Test Community",
    slug: "test-community",
    ownerId: "user-1",
    owner: { name: "Owner Name" },
    currentUserId: "user-1",
    imported: false,
    members: [
      {
        userId: "user-1",
        joinedAt: new Date(),
        user: {
          id: "user-1",
          name: "User One",
        },
      },
      {
        userId: "user-2",
        joinedAt: new Date(),
        user: {
          id: "user-2",
          name: "User Two",
        },
      },
    ],
  };

  it("shows the invite section to the owner", () => {
    render(
      <CommunityDetail community={mockCommunity} inviteUrl="http://invite" />,
    );

    expect(screen.getByText("Invite link")).toBeInTheDocument();
    expect(screen.getByText("http://invite")).toBeInTheDocument();
    expect(screen.getByText("Copy")).toBeInTheDocument();
  });

  it("hides the invite section from non-owners", () => {
    const nonOwnerCommunity = { ...mockCommunity, currentUserId: "user-2" };
    render(<CommunityDetail community={nonOwnerCommunity} />);

    expect(screen.queryByText("Invite link")).toBeNull();
    expect(screen.queryByText("Copy")).toBeNull();
    expect(screen.queryByText("Manage community")).toBeNull();
  });

  it("renders a view leaderboard link to the community hash", () => {
    render(
      <CommunityDetail community={mockCommunity} inviteUrl="http://invite" />,
    );

    const link = screen.getByText("View Leaderboard").closest("a");
    expect(link).toHaveAttribute("href", "/leaderboard#test-community");
  });

  it("shows the Share button for a member of a native community", () => {
    const memberCommunity = { ...mockCommunity, currentUserId: "user-2" };
    render(
      <CommunityDetail
        community={memberCommunity}
        shareUrl="http://example.com/share/test-community?t=123"
      />,
    );

    expect(screen.getByText("Share")).toBeInTheDocument();
  });

  it("shows the Share button for the owner of a native community", () => {
    render(
      <CommunityDetail
        community={mockCommunity}
        shareUrl="http://example.com/share/test-community?t=123"
      />,
    );

    expect(screen.getByText("Share")).toBeInTheDocument();
  });

  it("hides the Share button when the community is imported", () => {
    const importedCommunity = {
      ...mockCommunity,
      imported: true,
    };
    render(
      <CommunityDetail
        community={importedCommunity}
        shareUrl="http://example.com/share/test-community?t=123"
      />,
    );

    expect(screen.queryByText("Share")).toBeNull();
  });

  it("hides the Share button when no shareUrl is provided", () => {
    render(<CommunityDetail community={mockCommunity} />);

    expect(screen.queryByText("Share")).toBeNull();
  });
});
