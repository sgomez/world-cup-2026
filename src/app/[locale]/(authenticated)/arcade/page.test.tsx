import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "@/i18n/navigation";
import { getSession } from "@/lib/session";
import ArcadePage from "./page";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/session", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/i18n/navigation", () => ({
  redirect: vi.fn().mockImplementation(() => {
    throw new Error("REDIRECT");
  }),
}));

const mockGetRanking = vi.fn();
const mockHasPlayedToday = vi.fn();

vi.mock("@/lib/container", () => ({
  container: {
    arcade: () => ({
      getRanking: mockGetRanking,
      hasPlayedToday: mockHasPlayedToday,
    }),
    getNameResolver: vi.fn(() => vi.fn().mockResolvedValue(null)),
  },
}));

vi.mock("@/config/arcade", () => ({
  ARCADE_GAME_ENABLED: true,
}));

vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
  getTranslations: vi.fn(({ namespace }: { namespace: string }) => {
    const translations: Record<string, Record<string, string>> = {
      arcade: {
        pageTitle: "Arcade",
        pageDescription:
          "Play Penguin Run and compete on the global Arcade Ranking.",
        title: "Arcade Ranking",
        description: "Global ranking of Penguin Run daily high scores.",
        playButton: "Play Penguin Run",
        alreadyPlayedToday: "Already played today",
        resetsAt: "Resets at 00:00 UTC",
        starting: "Starting…",
        startError: "Could not start a run. Please try again.",
        noScores: "No scores yet — be the first to play!",
        rank: "#",
        player: "Player",
        score: "Score",
        you: "You",
        rankingDaily: "Today",
        rankingWeekly: "This Week",
        rankingAllTime: "All Time",
        descriptionDaily: "Best scores from today's runs.",
        descriptionWeekly: "Best scores from this week's runs.",
        descriptionAllTime: "All-time best scores across all runs.",
      },
    };
    return Promise.resolve(
      (key: string) => translations[namespace]?.[key] ?? key,
    );
  }),
}));

// Minimal mock for next-intl (client side, used by ArcadeSection and ArcadeRankingTabs)
vi.mock("next-intl", () => ({
  useTranslations: vi.fn((_namespace: string) => (key: string) => key),
}));

// ArcadeSection renders client components — mock it to avoid canvas env issues
vi.mock("@/components/arcade-section", () => ({
  ArcadeSection: ({ hasPlayedToday }: { hasPlayedToday: boolean }) => (
    <div data-testid="arcade-section" data-has-played={String(hasPlayedToday)}>
      ArcadeSection mock
    </div>
  ),
}));

// ArcadeRankingTabs is a client component — mock it for page-level tests
vi.mock("@/components/arcade-ranking-tabs", () => ({
  ArcadeRankingTabs: ({
    rankings,
    currentUserId,
  }: {
    rankings: {
      daily: { rank: number; userId: string; userName: string }[];
      weekly: { rank: number; userId: string; userName: string }[];
      all_time: { rank: number; userId: string; userName: string }[];
    };
    currentUserId?: string;
  }) => (
    <div
      data-testid="arcade-ranking-tabs"
      data-current-user={currentUserId}
      data-daily-count={String(rankings.daily.length)}
      data-weekly-count={String(rankings.weekly.length)}
      data-all-time-count={String(rankings.all_time.length)}
    >
      {rankings.daily.map((e) => (
        <span key={e.userId}>{e.userName}</span>
      ))}
    </div>
  ),
}));

const mockGetSession = vi.mocked(getSession);
const mockRedirect = vi.mocked(redirect);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ArcadePage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockRedirect.mockImplementation(() => {
      throw new Error("REDIRECT");
    });
    mockHasPlayedToday.mockResolvedValue(false);
    // Default: getRanking returns empty for all periods
    mockGetRanking.mockResolvedValue([]);
  });

  it("redirects to login when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);

    await expect(
      ArcadePage({ params: Promise.resolve({ locale: "en" }) }),
    ).rejects.toThrow("REDIRECT");

    expect(redirect).toHaveBeenCalledWith({ href: "/login", locale: "en" });
  });

  it("renders the arcade page with the section and ranking tabs", async () => {
    mockGetSession.mockResolvedValue({
      user: {
        id: "user-1",
        name: "Alice",
        email: "alice@example.com",
        role: "user",
      },
      session: { id: "session-1", impersonatedBy: null },
    } as any);

    mockGetRanking.mockResolvedValue([
      {
        rank: 1,
        userId: "user-1",
        userName: "Alice",
        bestScore: 50,
        achievedAt: new Date("2026-06-18T10:00:00Z"),
      },
    ]);

    const jsx = await ArcadePage({ params: Promise.resolve({ locale: "en" }) });
    render(jsx);

    // Page header
    expect(screen.getByText("Arcade")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Play Penguin Run and compete on the global Arcade Ranking.",
      ),
    ).toBeInTheDocument();

    // ArcadeSection rendered
    expect(screen.getByTestId("arcade-section")).toBeInTheDocument();
    expect(screen.getByTestId("arcade-section")).toHaveAttribute(
      "data-has-played",
      "false",
    );

    // ArcadeRankingTabs rendered
    expect(screen.getByTestId("arcade-ranking-tabs")).toBeInTheDocument();
  });

  it("passes hasPlayedToday correctly to ArcadeSection", async () => {
    mockGetSession.mockResolvedValue({
      user: {
        id: "user-1",
        name: "Alice",
        email: "alice@example.com",
        role: "user",
      },
      session: { id: "session-1", impersonatedBy: null },
    } as any);

    mockHasPlayedToday.mockResolvedValue(true);

    const jsx = await ArcadePage({ params: Promise.resolve({ locale: "en" }) });
    render(jsx);

    expect(screen.getByTestId("arcade-section")).toHaveAttribute(
      "data-has-played",
      "true",
    );
  });

  it("fetches all three periods and passes them to ArcadeRankingTabs", async () => {
    mockGetSession.mockResolvedValue({
      user: {
        id: "user-42",
        name: "Bob",
        email: "bob@example.com",
        role: "user",
      },
      session: { id: "session-2", impersonatedBy: null },
    } as any);

    const jsx = await ArcadePage({ params: Promise.resolve({ locale: "en" }) });
    render(jsx);

    // getRanking should be called for each period
    expect(mockGetRanking).toHaveBeenCalledWith(expect.any(Function), "daily");
    expect(mockGetRanking).toHaveBeenCalledWith(expect.any(Function), "weekly");
    expect(mockGetRanking).toHaveBeenCalledWith(
      expect.any(Function),
      "all_time",
    );
    expect(mockHasPlayedToday).toHaveBeenCalledWith("user-42");
  });

  it("passes the session userId to ArcadeRankingTabs as currentUserId", async () => {
    mockGetSession.mockResolvedValue({
      user: {
        id: "user-99",
        name: "Charlie",
        email: "charlie@example.com",
        role: "user",
      },
      session: { id: "session-3", impersonatedBy: null },
    } as any);

    const jsx = await ArcadePage({ params: Promise.resolve({ locale: "en" }) });
    render(jsx);

    expect(screen.getByTestId("arcade-ranking-tabs")).toHaveAttribute(
      "data-current-user",
      "user-99",
    );
  });

  it("passes all three period rankings to ArcadeRankingTabs", async () => {
    mockGetSession.mockResolvedValue({
      user: {
        id: "user-1",
        name: "Alice",
        email: "alice@example.com",
        role: "user",
      },
      session: { id: "session-1", impersonatedBy: null },
    } as any);

    // daily: 1 entry, weekly: 2 entries, all_time: 3 entries
    mockGetRanking
      .mockResolvedValueOnce([
        {
          rank: 1,
          userId: "user-1",
          userName: "Alice",
          bestScore: 50,
          achievedAt: new Date("2026-06-20T10:00:00Z"),
        },
      ])
      .mockResolvedValueOnce([
        {
          rank: 1,
          userId: "user-1",
          userName: "Alice",
          bestScore: 50,
          achievedAt: new Date("2026-06-20T10:00:00Z"),
        },
        {
          rank: 2,
          userId: "user-2",
          userName: "Bob",
          bestScore: 30,
          achievedAt: new Date("2026-06-18T10:00:00Z"),
        },
      ])
      .mockResolvedValueOnce([
        {
          rank: 1,
          userId: "user-3",
          userName: "Carol",
          bestScore: 80,
          achievedAt: new Date("2026-06-10T10:00:00Z"),
        },
        {
          rank: 2,
          userId: "user-1",
          userName: "Alice",
          bestScore: 50,
          achievedAt: new Date("2026-06-20T10:00:00Z"),
        },
        {
          rank: 3,
          userId: "user-2",
          userName: "Bob",
          bestScore: 30,
          achievedAt: new Date("2026-06-18T10:00:00Z"),
        },
      ]);

    const jsx = await ArcadePage({ params: Promise.resolve({ locale: "en" }) });
    render(jsx);

    const tabs = screen.getByTestId("arcade-ranking-tabs");
    expect(tabs).toHaveAttribute("data-daily-count", "1");
    expect(tabs).toHaveAttribute("data-weekly-count", "2");
    expect(tabs).toHaveAttribute("data-all-time-count", "3");
  });
});
