import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { LeaderboardEntry } from "@/modules/leaderboard/domain/leaderboard";
import { Leaderboard, type LeaderboardScope } from "./leaderboard";
import { LeaderboardTable } from "./leaderboard-table";

vi.mock("next-intl", () => ({
  useLocale: vi.fn(() => "en"),
  useTranslations: vi.fn((namespace) => {
    return (key: string, values?: Record<string, unknown>) => {
      if (namespace === "leaderboard") {
        const translations: Record<string, string> = {
          title: "Leaderboard",
          description: "Points ranking of your predictions.",
          rank: "#",
          participant: "Participant",
          points: "Points",
          you: "You",
          pts: "pts",
          noCommunities: "You don't belong to any communities yet.",
          joinOrCreate: "Join or create a community to start competing!",
          joinOrCreateButton: "Go to Communities",
          noBets: "No participants have closed bets yet in this community.",
          betsCount: `${values?.count ?? 0} Bets`,
          view: "View",
        };
        return translations[key] ?? key;
      }
      return key;
    };
  }),
}));

// Mock Link since next-intl/navigation isn't fully set up in test environment
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
    <a href={href} className={className}>
      {children}
    </a>
  ),
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe("LeaderboardTable Component", () => {
  const sampleEntries: LeaderboardEntry[] = [
    {
      betId: "bet-2",
      userId: "user-2",
      userName: "Bob",
      betName: "Bob Bet",
      points: 10,
      createdAt: new Date("2026-06-08T11:00:00Z"), // Bob is earlier
      rank: 1,
      hasCup: false,
      selectionsHidden: false,
      bet: null,
    },
    {
      betId: "bet-1",
      userId: "user-1",
      userName: "Alice",
      betName: "Alice Bet",
      points: 10,
      createdAt: new Date("2026-06-08T12:00:00Z"),
      rank: 1,
      hasCup: false,
      selectionsHidden: false,
      bet: null,
    },
    {
      betId: "bet-3",
      userId: "user-3",
      userName: "Charlie",
      betName: "Charlie Bet",
      points: 5,
      createdAt: new Date("2026-06-08T10:00:00Z"),
      rank: 3,
      hasCup: false,
      selectionsHidden: false,
      bet: null,
    },
  ];

  it("renders the empty state if there are no entries", () => {
    render(<LeaderboardTable entries={[]} />);
    expect(
      screen.getByText(
        "No participants have closed bets yet in this community.",
      ),
    ).toBeInTheDocument();
  });

  it("renders headers and ranked items as plain numbers (no Cup/medal icons)", () => {
    render(<LeaderboardTable entries={sampleEntries} currentUserId="user-1" />);

    // Table headers
    expect(screen.getByText("Participant")).toBeInTheDocument();
    expect(screen.getByText("Points")).toBeInTheDocument();

    // Ranks are plain numbers
    // In our mocked data, Bob is 1st (rank 1), Alice is 1st (rank 1), Charlie is 3rd (rank 3)
    const rankOnes = screen.getAllByText("1");
    const rankThrees = screen.getAllByText("3");

    expect(rankOnes).toHaveLength(2); // Bob and Alice
    expect(rankThrees).toHaveLength(1); // Charlie

    // Check participants and bet labels
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Alice Bet")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Bob Bet")).toBeInTheDocument();
    expect(screen.getByText("Charlie")).toBeInTheDocument();
    expect(screen.getByText("Charlie Bet")).toBeInTheDocument();
  });

  it("highlights the row matching the currentUserId with a 'You' badge", () => {
    render(<LeaderboardTable entries={sampleEntries} currentUserId="user-1" />);

    const youBadge = screen.getByText("You");
    expect(youBadge).toBeInTheDocument();

    // Check it highlight Alice specifically
    const aliceContainer = youBadge.closest("li");
    expect(aliceContainer).toHaveTextContent("Alice");
    expect(aliceContainer).not.toHaveTextContent("Bob");
  });

  it("renders plain numbers for all ranks when tournamentEnded is false", () => {
    render(
      <LeaderboardTable
        entries={sampleEntries}
        currentUserId="user-1"
        tournamentEnded={false}
      />,
    );

    // Rank 1 displays as plain number "1"
    const rankOnes = screen.getAllByText("1");
    expect(rankOnes).toHaveLength(2);

    // No emoji "🏆"
    expect(screen.queryByText("🏆")).not.toBeInTheDocument();
  });

  it("renders the 🏆 emoji for rank 1 and plain numbers for other ranks when tournamentEnded is true", () => {
    // For test purposes, we will mock entries where rank === 1 hasCup is set (though table component checks rank === 1 directly)
    render(
      <LeaderboardTable
        entries={sampleEntries}
        currentUserId="user-1"
        tournamentEnded={true}
      />,
    );

    // Rank 1 should NOT display as plain number "1"
    expect(screen.queryByText("1")).not.toBeInTheDocument();

    // Instead, there should be multiple 🏆 emojis (one for Bob, one for Alice)
    const cups = screen.getAllByText("🏆");
    expect(cups).toHaveLength(2);

    // Bob is tied for 1st, so Bob's row has 🏆
    const bobRow = cups[0].closest("li");
    expect(bobRow).toHaveTextContent("Bob");

    // Alice is tied for 1st, so Alice's row has 🏆
    const aliceRow = cups[1].closest("li");
    expect(aliceRow).toHaveTextContent("Alice");

    // Charlie has rank 3, so Charlie's row should still display plain number "3"
    const rankThree = screen.getByText("3");
    expect(rankThree).toBeInTheDocument();
    const charlieRow = rankThree.closest("li");
    expect(charlieRow).toHaveTextContent("Charlie");
  });

  it("implements row swap, view buttons, and signatures", () => {
    // Add signatures to the sample entries
    const entriesWithSigs: LeaderboardEntry[] = sampleEntries.map((e) => ({
      ...e,
      signature: `signature-for-${e.betId}`,
    }));

    render(
      <LeaderboardTable
        entries={entriesWithSigs}
        currentUserId="user-1"
        communitySlug="my-community"
      />,
    );

    // 1. Bet label is main title, owner name is below it.
    // They should both be in the same row.
    const aliceRow = screen.getByText("Alice Bet").closest("li");
    expect(aliceRow).toHaveTextContent("Alice");
    expect(aliceRow).toHaveTextContent("Alice Bet");

    // 2. (YOU) chip renders for the current user's rows
    const youChip = screen.getByText("You");
    expect(youChip).toBeInTheDocument();
    expect(youChip.closest("li")).toBe(aliceRow);

    // 3. Truncated signature renders on each row
    expect(screen.getAllByText("signatur")).toHaveLength(3); // slice(0, 8) of "signature-for-bet-X"

    // 4. View button links:
    // Sorted order: Bob (points 10, earlier), Alice (points 10), Charlie (points 5)
    const viewLinks = screen.getAllByRole("link", { name: "View" });
    expect(viewLinks).toHaveLength(3);

    expect(viewLinks[0]).toHaveAttribute(
      "href",
      "/communities/my-community/bets/bet-2",
    );
    expect(viewLinks[1]).toHaveAttribute("href", "/bets/bet-1");
    expect(viewLinks[2]).toHaveAttribute(
      "href",
      "/communities/my-community/bets/bet-3",
    );
  });
});

describe("Leaderboard Component (Tabs)", () => {
  const sampleScopes: LeaderboardScope[] = [
    {
      id: "community-a",
      label: "Community A",
      entries: [
        {
          betId: "bet-1",
          userId: "user-1",
          userName: "Alice",
          betName: "Alice Bet",
          points: 10,
          createdAt: new Date("2026-06-08T12:00:00Z"),
          rank: 1,
          hasCup: false,
          selectionsHidden: false,
          bet: null,
        },
      ],
    },
    {
      id: "community-b",
      label: "Community B",
      entries: [
        {
          betId: "bet-2",
          userId: "user-2",
          userName: "Bob",
          betName: "Bob Bet",
          points: 15,
          createdAt: new Date("2026-06-08T12:00:00Z"),
          rank: 1,
          hasCup: false,
          selectionsHidden: false,
          bet: null,
        },
      ],
    },
  ];

  it("renders empty state when user belongs to zero communities", () => {
    render(<Leaderboard scopes={[]} />);
    expect(
      screen.getByText("You don't belong to any communities yet."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Go to Communities" }),
    ).toHaveAttribute("href", "/communities");
  });

  it("renders a tab for each community", () => {
    render(<Leaderboard scopes={sampleScopes} />);

    // Renders tabs
    expect(screen.getByText("Community A")).toBeInTheDocument();
    expect(screen.getByText("Community B")).toBeInTheDocument();
  });

  it("switches tables when tabs are clicked", () => {
    render(<Leaderboard scopes={sampleScopes} />);

    // Initially active is Community A, so Alice is visible, Bob is not
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.queryByText("Bob")).not.toBeInTheDocument();

    // Click on Community B tab
    const tabB = screen.getByRole("tab", { name: "Community B" });
    fireEvent.click(tabB);

    // Now Bob is visible, Alice is not
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.queryByText("Alice")).not.toBeInTheDocument();
  });

  it("passes tournamentEnded prop to LeaderboardTable", () => {
    render(<Leaderboard scopes={sampleScopes} tournamentEnded={true} />);
    // Alice is 1st in Community A (default active tab), so she should have 🏆
    expect(screen.getByText("🏆")).toBeInTheDocument();
    expect(screen.queryByText("1")).not.toBeInTheDocument();
  });
});
