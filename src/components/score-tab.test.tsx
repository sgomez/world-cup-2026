import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createInitialState } from "@/lib/prediction-state";
import { ScoreTab } from "./score-tab";

vi.mock("next-intl", () => ({
  useLocale: vi.fn(() => "en"),
  useTranslations: vi.fn((namespace) => {
    return (key: string) => {
      if (namespace === "score") {
        return (
          {
            champion: "Champion",
            thirdPlace: "Third Place",
            notYetDetermined: "Not yet determined",
            noTeamsYet: "No teams yet",
            subtotal: "Subtotal",
            correct: "correct",
            ptsPerTeam: "pts per team",
            pointsBreakdown: "Points Breakdown",
          }[key] ?? key
        );
      }
      return key;
    };
  }),
}));

describe("ScoreTab", () => {
  it("renders 'Not yet determined' for champion and third place when predictions are empty", () => {
    const state = createInitialState(null);
    render(<ScoreTab state={state} />);

    // It should render "Not yet determined" for both Champion and Third Place
    const placeholders = screen.getAllByText("Not yet determined");
    expect(placeholders).toHaveLength(2);
  });

  it("renders the selected champion when set in knockout stage", () => {
    const state = createInitialState(null);
    // Manually set the winner of the final match "F"
    state.knockoutMatches.F = {
      id: "F",
      round: "F",
      team1Id: "mex",
      team2Id: "usa",
      winnerId: "mex",
      loserId: "usa",
    };

    render(<ScoreTab state={state} />);

    // Get the card containing the Champion header
    const championHeader = screen.getByText("Champion");
    const headerParent = championHeader.parentElement;
    if (!headerParent) throw new Error("Header parent not found");
    const championCard = headerParent.parentElement;
    if (!championCard) throw new Error("Champion card parent not found");

    expect(within(championCard).getByText("Mexico")).toBeInTheDocument();
  });

  it("renders the selected third place when set in knockout stage", () => {
    const state = createInitialState(null);
    // Manually set the winner of the third place match "3RD"
    state.knockoutMatches["3RD"] = {
      id: "3RD",
      round: "3RD",
      team1Id: "bra",
      team2Id: "arg",
      winnerId: "bra",
      loserId: "arg",
    };

    render(<ScoreTab state={state} />);

    // Get the card containing the Third Place header
    const thirdPlaceHeader = screen.getByText("Third Place");
    const headerParent = thirdPlaceHeader.parentElement;
    if (!headerParent) throw new Error("Header parent not found");
    const thirdPlaceCard = headerParent.parentElement;
    if (!thirdPlaceCard) throw new Error("Third Place card parent not found");

    expect(within(thirdPlaceCard).getByText("Brazil")).toBeInTheDocument();
  });

  it("renders non-zero points in per-round points and breakdown rows when teams match a real answer key", () => {
    const state = createInitialState(null);
    state.knockoutMatches["R32-73"] = {
      id: "R32-73",
      round: "R32",
      team1Id: "mex",
      team2Id: "usa",
      winnerId: "mex",
      loserId: "usa",
    };

    const actualResults = {
      R32: ["MEX", "USA"],
      R16: [],
      QF: [],
      SF: [],
      F: [],
      champion: null,
      thirdPlace: null,
    };

    render(<ScoreTab state={state} actualResults={actualResults} />);

    // Since MEX and USA match in R32 (3 points per team), total should be 6
    const sixElements = screen.getAllByText("6");
    expect(sixElements.length).toBeGreaterThanOrEqual(2);

    // Verify round subtotal shows non-zero (since matchedTeams.length > 0)
    const r32Title = screen.getByText("roundOf32");
    const r32HeaderParent = r32Title.parentElement;
    if (!r32HeaderParent) throw new Error("R32 Header parent not found");
    const r32HeaderRow = r32HeaderParent.parentElement;
    if (!r32HeaderRow) throw new Error("R32 Header row parent not found");
    const r32Card = r32HeaderRow.parentElement;
    if (!r32Card) throw new Error("R32 card parent not found");

    expect(within(r32Card).getByText(/Subtotal/)).toBeInTheDocument();
    expect(within(r32Card).getByText("6 pts")).toBeInTheDocument();

    // The breakdown row for Round of 32 should show 6 points
    const breakdownRow = screen.getByText("roundOf32Label");
    const rowParent = breakdownRow.parentElement;
    if (!rowParent) throw new Error("Breakdown row parent not found");
    expect(within(rowParent).getByText("6")).toBeInTheDocument();
  });
});

describe("ScoreTab provisional warning", () => {
  const state = createInitialState(null, null, "en");

  it("does NOT render provisional warning note when hasLiveMatch is false", () => {
    render(<ScoreTab state={state} hasLiveMatch={false} />);
    expect(screen.queryByText("provisionalNote")).not.toBeInTheDocument();
  });

  it("renders provisional warning note when hasLiveMatch is true", () => {
    render(<ScoreTab state={state} hasLiveMatch={true} />);
    expect(screen.getByText("provisionalNote")).toBeInTheDocument();
  });
});
