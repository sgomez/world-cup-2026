import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { KnockoutMatch } from "@/modules/bracket";
import type { LiveResultState } from "@/modules/live/domain/live-result";
import { CalendarView } from "./calendar-view";

vi.mock("next-intl", () => ({
  useTranslations: vi.fn(
    () => (key: string, params?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        live: "LIVE",
        upcoming: "Upcoming",
        finished: "Finished",
        allTeams: "All Teams",
        allPhases: "All Phases",
        jumpToToday: "Jump to Today",
        noMatches: "No matches found",
        timezoneNote: `TZ: ${params?.tz ?? "UTC"}`,
        winnerGroup: `Winner Group ${params?.group}`,
        runnerUpGroup: `Runner-up Group ${params?.group}`,
        winnerMatch: `Winner Match ${params?.num}`,
        loserMatch: `Loser Match ${params?.num}`,
        bestThird: `Best 3rd ${params?.groups}`,
        groupStage: "Group Stage",
        title: "Tournament Calendar",
        description: "Match schedule",
      };
      return map[key] ?? key;
    },
  ),
  useLocale: vi.fn(() => "en"),
}));

vi.mock("@/i18n/navigation", () => ({
  useRouter: vi.fn(() => ({ refresh: vi.fn() })),
}));

// Minimal worldcup data for tests
vi.mock("@/../data/worldcup.json", () => ({
  default: {
    matches: [
      {
        round: "Matchday 1",
        num: 1,
        date: "2026-06-11",
        time: "14:00 UTC-6",
        team1: "Mexico",
        team2: "South Africa",
        group: "Group A",
        ground: "Mexico City",
      },
      {
        round: "Matchday 1",
        num: 2,
        date: "2026-06-11",
        time: "12:00 UTC-6",
        team1: "South Korea",
        team2: "Czech Republic",
        group: "Group A",
        ground: "Guadalajara (Zapopan)",
      },
      {
        round: "Round of 32",
        num: 73,
        date: "2026-06-28",
        time: "12:00 UTC-7",
        team1: "2A",
        team2: "2B",
        ground: "Los Angeles",
      },
    ],
  },
}));

const emptyBracket: Record<string, KnockoutMatch> = {};

describe("CalendarView", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("renders a group-stage match as UPCOMING when no LiveResult exists", () => {
    render(
      <CalendarView liveResults={[]} bracketView={emptyBracket} locale="en" />,
    );
    // Status badge for upcoming
    expect(screen.getAllByText("Upcoming").length).toBeGreaterThan(0);
  });

  it("renders a LIVE match with current score", () => {
    const liveResult: LiveResultState = {
      num: 1,
      status: "live",
      goals1: 1,
      goals2: 0,
    };
    render(
      <CalendarView
        liveResults={[liveResult]}
        bracketView={emptyBracket}
        locale="en"
      />,
    );
    expect(screen.getByText("LIVE")).toBeInTheDocument();
    // Score digits should appear
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("0").length).toBeGreaterThan(0);
  });

  it("renders a FINISHED match with final score", () => {
    const liveResult: LiveResultState = {
      num: 1,
      status: "finished",
      goals1: 2,
      goals2: 1,
    };
    render(
      <CalendarView
        liveResults={[liveResult]}
        bracketView={emptyBracket}
        locale="en"
      />,
    );
    expect(screen.getByText("Finished")).toBeInTheDocument();
    expect(screen.getAllByText("2").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
  });

  it("shows penalty score for a penalty-decided knockout match", () => {
    const liveResult: LiveResultState = {
      num: 73,
      status: "finished",
      goals1: 1,
      goals2: 1,
      penalties1: 5,
      penalties2: 3,
    };
    render(
      <CalendarView
        liveResults={[liveResult]}
        bracketView={emptyBracket}
        locale="en"
      />,
    );
    // Penalty scores (5 and 3) should appear
    expect(screen.getAllByText("5").length).toBeGreaterThan(0);
    expect(screen.getAllByText("3").length).toBeGreaterThan(0);
  });

  it("shows TBD placeholder for unsettled knockout match", () => {
    render(
      <CalendarView liveResults={[]} bracketView={emptyBracket} locale="en" />,
    );
    // The knockout match with "2A"/"2B" codes should render placeholder labels
    expect(screen.getByText("Runner-up Group A")).toBeInTheDocument();
    expect(screen.getByText("Runner-up Group B")).toBeInTheDocument();
  });

  it("resolves knockout team names from bracketView when settled", () => {
    const bracket: Record<string, KnockoutMatch> = {
      "R32-73": {
        id: "R32-73",
        round: "R32",
        team1Id: "mex",
        team2Id: "kor",
        winnerId: null,
        loserId: null,
      },
    };
    render(<CalendarView liveResults={[]} bracketView={bracket} locale="en" />);
    // With bracket resolution, "Runner-up Group A/B" placeholders should be gone
    expect(screen.queryByText("Runner-up Group A")).not.toBeInTheDocument();
    expect(screen.queryByText("Runner-up Group B")).not.toBeInTheDocument();
    // And the resolved team names should appear in the match grid
    // Korea Republic is the normalised name for South Korea (kor)
    // It may appear multiple times (match card + team filter option)
    expect(screen.getAllByText("Korea Republic").length).toBeGreaterThan(0);
  });

  it("sorts matches chronologically by time within each day", () => {
    render(
      <CalendarView liveResults={[]} bracketView={emptyBracket} locale="en" />,
    );

    // Get the container for the day's matches
    const allMatchesContainer = screen.getByText(
      "Thursday, June 11, 2026",
    ).parentElement;
    expect(allMatchesContainer).toBeInTheDocument();

    const textContent = allMatchesContainer?.textContent || "";
    const koreaIndex = textContent.indexOf("Korea Republic");
    const mexicoIndex = textContent.indexOf("Mexico");

    // "Korea Republic" (13:00 UTC-6 kickoff) must appear before "Mexico" (20:00 UTC-6 kickoff)
    expect(koreaIndex).toBeGreaterThan(-1);
    expect(mexicoIndex).toBeGreaterThan(-1);
    expect(koreaIndex).toBeLessThan(mexicoIndex);
  });
});
