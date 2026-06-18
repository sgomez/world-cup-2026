import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "@/i18n/navigation";
import { getSession } from "@/lib/session";
import LeaderboardPage from "./page";

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

const mockLeaderboardGet = vi.fn();
const mockTournamentGet = vi.fn();
const mockLiveFindAll = vi.fn();
const mockCommunityFindMany = vi.fn();

vi.mock("@/lib/container", () => ({
  container: {
    leaderboard: () => ({ get: mockLeaderboardGet }),
    tournament: () => ({ get: mockTournamentGet }),
    live: () => ({ findAll: mockLiveFindAll }),
    getNameResolver: vi.fn(() => vi.fn().mockResolvedValue(null)),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    community: {
      findMany: (...args: Parameters<typeof mockCommunityFindMany>) =>
        mockCommunityFindMany(...args),
    },
  },
}));

vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
}));

// Leaderboard renders client components — mock to avoid env issues
vi.mock("@/components/leaderboard", () => ({
  Leaderboard: ({
    scopes,
    currentUserId,
    tournamentEnded,
    hasLiveMatch,
  }: {
    scopes: { id: string; label: string }[];
    currentUserId?: string;
    tournamentEnded?: boolean;
    hasLiveMatch?: boolean;
  }) => (
    <div
      data-testid="leaderboard"
      data-scopes={scopes.map((s) => s.id).join(",")}
      data-current-user-id={currentUserId}
      data-tournament-ended={String(tournamentEnded)}
      data-has-live-match={String(hasLiveMatch)}
    >
      Leaderboard mock
    </div>
  ),
}));

vi.mock("@/modules/live/domain/live-result", () => ({
  hasLiveMatch: vi.fn(() => false),
}));

vi.mock("@/modules/tournament/domain/tournament", () => ({
  Tournament: {
    createDefault: vi.fn(() => ({
      isCompetitionEnded: vi.fn(() => false),
    })),
  },
}));

const mockGetSession = vi.mocked(getSession);
const mockRedirect = vi.mocked(redirect);

const SESSION = {
  user: {
    id: "user-1",
    name: "Alice",
    email: "alice@example.com",
    role: "user" as const,
  },
  session: { id: "session-1", impersonatedBy: null },
} as any;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("LeaderboardPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockRedirect.mockImplementation(() => {
      throw new Error("REDIRECT");
    });
    mockCommunityFindMany.mockResolvedValue([]);
    mockTournamentGet.mockResolvedValue(null);
    mockLiveFindAll.mockResolvedValue([]);
    mockLeaderboardGet.mockResolvedValue({ isOk: () => false });
  });

  it("redirects to login when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);

    await expect(
      LeaderboardPage({ params: Promise.resolve({ locale: "en" }) }),
    ).rejects.toThrow("REDIRECT");

    expect(redirect).toHaveBeenCalledWith({ href: "/login", locale: "en" });
  });

  it("renders the Leaderboard component directly (no tabs, no arcade UI)", async () => {
    mockGetSession.mockResolvedValue(SESSION);

    const jsx = await LeaderboardPage({
      params: Promise.resolve({ locale: "en" }),
    });
    render(jsx);

    expect(screen.getByTestId("leaderboard")).toBeInTheDocument();
    expect(screen.queryByTestId("arcade-section")).not.toBeInTheDocument();
  });

  it("passes the session userId to Leaderboard as currentUserId", async () => {
    mockGetSession.mockResolvedValue(SESSION);

    const jsx = await LeaderboardPage({
      params: Promise.resolve({ locale: "en" }),
    });
    render(jsx);

    expect(screen.getByTestId("leaderboard")).toHaveAttribute(
      "data-current-user-id",
      "user-1",
    );
  });

  it("does not call arcade container methods", async () => {
    mockGetSession.mockResolvedValue(SESSION);

    // container mock has no arcade() — if it were called the test would throw
    await LeaderboardPage({ params: Promise.resolve({ locale: "en" }) });
    // reaching here without errors confirms arcade() was not invoked
  });
});
