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
      },
    };
    return Promise.resolve(
      (key: string) => translations[namespace]?.[key] ?? key,
    );
  }),
}));

// Minimal mock for next-intl (client side, used by ArcadeSection subcomponents)
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
    mockGetRanking.mockResolvedValue([]);
  });

  it("redirects to login when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);

    await expect(
      ArcadePage({ params: Promise.resolve({ locale: "en" }) }),
    ).rejects.toThrow("REDIRECT");

    expect(redirect).toHaveBeenCalledWith({ href: "/login", locale: "en" });
  });

  it("renders the arcade page with the section and ranking table", async () => {
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

    // Arcade ranking table shows the entry
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
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

  it("passes the session userId to getRanking and hasPlayedToday", async () => {
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

    expect(mockHasPlayedToday).toHaveBeenCalledWith("user-42");
    expect(mockGetRanking).toHaveBeenCalledWith(expect.any(Function));
  });
});
