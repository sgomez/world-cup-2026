import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRouter } from "@/i18n/navigation";
import { StandingsView } from "./standings-view";

vi.mock("next-intl", () => ({
  useTranslations: vi.fn(
    () => (key: string, params?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        title: "Tournament Standings",
        description: "Follow the live standings and tournament bracket.",
        groupStage: "Group Stage",
        knockoutStage: "Knockout Stage",
        pos: "#",
        team: "Team",
        pts: "PTS",
        gf: "GF",
        ga: "GA",
        gd: "GD",
        bestThirds: "Best Third-place Teams",
        liveMarker: "LIVE",
        liveMarkerLegend: "Team is currently playing a live match",
        group: `Group ${params?.letter ?? ""}`,
        qualifies: `${params?.qualify ?? ""} qualify from ${params?.total ?? ""}`,
        match: `Match ${params?.number ?? ""}`,
        matchCount: `${params?.count ?? ""} matches`,
        roundOf32: "Round of 32",
        roundOf16: "Round of 16",
        quarterFinals: "Quarter Finals",
        semiFinals: "Semi Finals",
        thirdPlaceMatch: "3rd Place Match",
        final: "Final",
        winnerGroup: `Winner Group ${params?.group ?? ""}`,
        runnerUpGroup: `Runner-up Group ${params?.group ?? ""}`,
        bestThird: `Best 3rd ${params?.groups ?? ""}`,
        winnerMatch: `Winner Match ${params?.num ?? ""}`,
        loserMatch: `Loser Match ${params?.num ?? ""}`,
        groupStagePhase: "Group Stage",
        upcoming: "Upcoming",
        finished: "Finished",
      };
      return map[key] ?? key;
    },
  ),
}));

vi.mock("@/i18n/navigation", () => ({
  useRouter: vi.fn(() => ({ refresh: vi.fn() })),
}));

// Minimal teams/groups mock
vi.mock("@/lib/teams", () => {
  const mockGroups = [
    {
      group: "A",
      teams: [
        { id: "mex", name: "Mexico", flag: "🇲🇽", code: "mx" },
        { id: "rsa", name: "South Africa", flag: "🇿🇦", code: "za" },
        { id: "kor", name: "Korea Republic", flag: "🇰🇷", code: "kr" },
        { id: "cze", name: "Czech Republic", flag: "🇨🇿", code: "cz" },
      ],
    },
    {
      group: "B",
      teams: [
        { id: "arg", name: "Argentina", flag: "🇦🇷", code: "ar" },
        { id: "bra", name: "Brazil", flag: "🇧🇷", code: "br" },
        { id: "uru", name: "Uruguay", flag: "🇺🇾", code: "uy" },
        { id: "par", name: "Paraguay", flag: "🇵🇾", code: "py" },
      ],
    },
  ];

  return {
    getGroups: vi.fn(() => mockGroups),
    getAllTeamsLookup: vi.fn(() => new Map()),
    getTeamByName: vi.fn((name: string) => {
      const normalizedSearch = name.trim().toLowerCase();
      for (const group of mockGroups) {
        const found = group.teams.find(
          (t) =>
            t.name.toLowerCase() === normalizedSearch ||
            t.id.toLowerCase() === normalizedSearch,
        );
        if (found) return found;
      }
      return null;
    }),
    getTeamById: vi.fn((id: string) => {
      for (const group of mockGroups) {
        const found = group.teams.find((t) => t.id === id);
        if (found) return found;
      }
      return null;
    }),
  };
});

vi.mock("@/lib/matches", () => ({
  getAllMatches: vi.fn(() => [
    {
      num: 1,
      team1: "South Africa",
      team2: "Mexico",
      group: "Group A",
      round: "Group Stage",
    },
  ]),
}));

// Mock bracket-core to avoid complex bracket logic
vi.mock("@/lib/bracket-core", () => ({
  matchProgression: {},
  R32_MATCHUPS: [],
  ROUND_ORDER: ["R32", "R16", "QF", "SF", "3RD", "F"],
  applyWinnerToMatches: vi.fn((matches: Record<string, unknown>) => matches),
  createEmptyKnockoutMatches: vi.fn(() => ({})),
  getTeamIdFromPosition: vi.fn(() => null),
}));

// Mock prediction-state
vi.mock("@/lib/prediction-state", () => ({
  getAllTeamsLookup: vi.fn(() => new Map()),
  KNOCKOUT_MATCH_IDS: {
    R32: [],
    R16: [],
    QF: [],
    SF: [],
    "3RD": [],
    F: [],
  },
}));

// Mock derive-result
vi.mock("@/modules/tournament/domain/derive-result", () => ({
  computeTournamentBracket: vi.fn(() => ({})),
}));

describe("StandingsView", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("renders group stage tab by default when not all R32 settled", () => {
    render(
      <StandingsView defaultTab="groups" locale="en" liveTeamIds={new Set()} />,
    );
    // Group tab should be visible and active
    expect(screen.getByText("Group Stage")).toBeInTheDocument();
  });

  it("shows knockout tab when defaultTab is knockout", () => {
    render(
      <StandingsView
        defaultTab="knockout"
        locale="en"
        liveTeamIds={new Set()}
      />,
    );
    expect(screen.getByText("Knockout Stage")).toBeInTheDocument();
  });

  it("does not show live marker when no teams are live", () => {
    render(
      <StandingsView defaultTab="groups" locale="en" liveTeamIds={new Set()} />,
    );
    // The live marker text should not appear
    expect(screen.queryByText("LIVE")).not.toBeInTheDocument();
  });

  it("shows flashing live marker next to a team in a live match", () => {
    render(
      <StandingsView
        defaultTab="groups"
        locale="en"
        liveTeamIds={new Set(["mex"])}
      />,
    );
    // The LIVE marker for Mexico should appear
    expect(screen.getAllByText("LIVE").length).toBeGreaterThan(0);
  });

  it("shows live legend when at least one team is live", () => {
    render(
      <StandingsView
        defaultTab="groups"
        locale="en"
        liveTeamIds={new Set(["mex"])}
      />,
    );
    expect(
      screen.getByText("Team is currently playing a live match"),
    ).toBeInTheDocument();
  });

  it("does not show live legend when no teams are live", () => {
    render(
      <StandingsView defaultTab="groups" locale="en" liveTeamIds={new Set()} />,
    );
    expect(
      screen.queryByText("Team is currently playing a live match"),
    ).not.toBeInTheDocument();
  });

  it("shows live marker for multiple live teams", () => {
    render(
      <StandingsView
        defaultTab="groups"
        locale="en"
        liveTeamIds={new Set(["mex", "rsa"])}
      />,
    );
    // Both Mexico and South Africa should have LIVE markers
    expect(screen.getAllByText("LIVE").length).toBeGreaterThanOrEqual(2);
  });

  it("starts polling on mount and calls router.refresh at 30s interval", () => {
    const mockRefresh = vi.fn();
    vi.mocked(useRouter).mockReturnValue({
      refresh: mockRefresh,
    } as unknown as ReturnType<typeof useRouter>);

    render(
      <StandingsView defaultTab="groups" locale="en" liveTeamIds={new Set()} />,
    );

    // No refresh yet at t=0
    expect(mockRefresh).not.toHaveBeenCalled();

    // Advance 30 seconds
    vi.advanceTimersByTime(30_000);
    expect(mockRefresh).toHaveBeenCalledTimes(1);

    // Advance another 30 seconds
    vi.advanceTimersByTime(30_000);
    expect(mockRefresh).toHaveBeenCalledTimes(2);
  });

  it("computes and displays actual group team statistics when liveResults are provided", () => {
    const liveResults = [
      { num: 1, status: "finished", goals1: 2, goals2: 1 }, // South Africa 2 - 1 Mexico
    ] as any;

    render(
      <StandingsView
        defaultTab="groups"
        locale="en"
        liveTeamIds={new Set()}
        liveResults={liveResults}
      />,
    );

    // South Africa (rsa) should have 3 points, 2 GF, 1 GA, +1 GD
    // Mexico (mex) should have 0 points, 1 GF, 2 GA, -1 GD
    expect(screen.getAllByText("3").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("+1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("-1").length).toBeGreaterThan(0);
  });
});
