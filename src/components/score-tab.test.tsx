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
});
