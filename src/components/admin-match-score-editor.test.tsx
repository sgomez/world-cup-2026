import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { upsertLiveResultAction } from "@/app/actions/live";
import { AdminMatchScoreEditor } from "./admin-match-score-editor";

vi.mock("next-intl", () => ({
  useTranslations: vi.fn(
    (_ns) => (key: string, params?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        // calendar
        live: "LIVE",
        upcoming: "Upcoming",
        finished: "Finished",
        allTeams: "All Teams",
        allPhases: "All Phases",
        winnerGroup: `Winner Group ${params?.group}`,
        runnerUpGroup: `Runner-up Group ${params?.group}`,
        winnerMatch: `Winner Match ${params?.num}`,
        loserMatch: `Loser Match ${params?.num}`,
        bestThird: `Best 3rd ${params?.groups}`,
        groupStage: "Group Stage",
        // adminMatchEditor
        matchLabel: `Match ${params?.num}`,
        groupLabel: `Group ${params?.group}`,
        statusUpcoming: "Upcoming",
        statusLive: "Live",
        statusFinished: "Finished",
        savedSuccess: "Saved successfully",
        filterTitle: "Filters",
      };
      return map[key] ?? key;
    },
  ),
}));

vi.mock("@/app/actions/live", () => ({
  upsertLiveResultAction: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/components/ui/toast", () => ({
  useToast: vi.fn(() => ({
    toast: vi.fn(),
  })),
}));

vi.mock("@/../data/worldcup.json", () => ({
  default: {
    matches: [
      {
        round: "Matchday 1",
        num: 1,
        date: "2026-06-11",
        time: "13:00 UTC-6",
        team1: "Mexico",
        team2: "South Africa",
        group: "Group A",
        ground: "Mexico City",
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

describe("AdminMatchScoreEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all matches grouped by phase and date", () => {
    render(
      <AdminMatchScoreEditor
        matches={[
          {
            round: "Matchday 1",
            num: 1,
            date: "2026-06-11",
            time: "13:00 UTC-6",
            team1: "Mexico",
            team2: "South Africa",
            group: "Group A",
            ground: "Mexico City",
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
        ]}
        liveResults={[]}
        bracketView={{}}
        locale="en"
      />,
    );

    // Should display the matches
    expect(screen.getByText("Match 1")).toBeInTheDocument();
    expect(screen.getByText("Match 73")).toBeInTheDocument();
    // Headers for phases
    expect(screen.getAllByText("Group Stage").length).toBeGreaterThan(0);
  });

  it("disables penalty inputs for knockout match when scores are not tied", () => {
    render(
      <AdminMatchScoreEditor
        matches={[
          {
            round: "Round of 32",
            num: 73,
            date: "2026-06-28",
            time: "12:00 UTC-7",
            team1: "2A",
            team2: "2B",
            ground: "Los Angeles",
          },
        ]}
        liveResults={[
          {
            num: 73,
            status: "finished",
            goals1: 2,
            goals2: 1,
          },
        ]}
        bracketView={{}}
        locale="en"
      />,
    );

    // Find penalty inputs by their ARIA label
    const penalty1Input = screen.getByLabelText("penalties1Label");
    expect(penalty1Input).toBeDisabled();
  });

  it("triggers save when changing status option", async () => {
    const mockUpsert = vi.mocked(upsertLiveResultAction);

    render(
      <AdminMatchScoreEditor
        matches={[
          {
            round: "Matchday 1",
            num: 1,
            date: "2026-06-11",
            time: "13:00 UTC-6",
            team1: "Mexico",
            team2: "South Africa",
            group: "Group A",
            ground: "Mexico City",
          },
        ]}
        liveResults={[]}
        bracketView={{}}
        locale="en"
      />,
    );

    const selects = screen.getAllByRole("combobox");
    const statusSelect = selects[2]; // Third select is the match card status dropdown
    fireEvent.change(statusSelect, { target: { value: "live" } });

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalledWith({
        num: 1,
        status: "live",
        goals1: 0,
        goals2: 0,
        allowCreate: true,
        adminOverride: true,
      });
    });
  });

  it("triggers save on blur when goals input changes", async () => {
    const mockUpsert = vi.mocked(upsertLiveResultAction);

    render(
      <AdminMatchScoreEditor
        matches={[
          {
            round: "Matchday 1",
            num: 1,
            date: "2026-06-11",
            time: "13:00 UTC-6",
            team1: "Mexico",
            team2: "South Africa",
            group: "Group A",
            ground: "Mexico City",
          },
        ]}
        liveResults={[
          {
            num: 1,
            status: "live",
            goals1: 0,
            goals2: 0,
          },
        ]}
        bracketView={{}}
        locale="en"
      />,
    );

    const input = screen.getByLabelText("goals1Label");
    fireEvent.change(input, { target: { value: "3" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalledWith({
        num: 1,
        status: "live",
        goals1: 3,
        goals2: 0,
        allowCreate: true,
        adminOverride: true,
      });
    });
  });
});
