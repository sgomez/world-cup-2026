import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createInitialState } from "@/modules/bracket";
import { KnockoutBracket } from "./knockout-bracket";

vi.mock("next-intl", () => ({
  useLocale: vi.fn(() => "en"),
  useTranslations: vi.fn(
    () => (key: string, params?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        roundOf32: "Round of 32",
        roundOf16: "Round of 16",
        quarterFinals: "Quarter Finals",
        semiFinals: "Semi Finals",
        thirdPlaceMatch: "3rd Place Match",
        final: "Final",
        match: `Match ${params?.number ?? ""}`,
        matchCount: `${params?.count ?? ""} matches`,
      };
      return map[key] ?? key;
    },
  ),
}));

describe("KnockoutBracket - editable mode", () => {
  it("renders the bracket rounds and handles winner toggle", async () => {
    // Generate initial state with no predictions
    const state = createInitialState(null, null);

    // Clear all matches to avoid duplicate teams in other default slots
    for (const matchId of Object.keys(state.knockoutMatches)) {
      state.knockoutMatches[matchId] = {
        id: matchId,
        round: state.knockoutMatches[matchId].round,
        team1Id: null,
        team2Id: null,
        winnerId: null,
        loserId: null,
      };
    }

    // Set a clean specific matchup in R32-73
    state.knockoutMatches["R32-73"] = {
      id: "R32-73",
      round: "R32",
      team1Id: "arg", // Argentina
      team2Id: "bra", // Brazil
      winnerId: null,
      loserId: null,
    };

    const dispatch = vi.fn();

    const { rerender } = render(
      <KnockoutBracket mode="editable" state={state} dispatch={dispatch} />,
    );

    // Verify round headers render
    expect(screen.getByText("Round of 32")).toBeInTheDocument();

    // Find Argentina and Brazil buttons
    const argButton = screen.getByRole("button", { name: /argentina/i });
    const braButton = screen.getByRole("button", { name: /brazil/i });

    expect(argButton).toBeInTheDocument();
    expect(braButton).toBeInTheDocument();

    // Click Argentina to make them winner
    await userEvent.click(argButton);
    expect(dispatch).toHaveBeenCalledWith({
      type: "SET_KNOCKOUT_WINNER",
      matchId: "R32-73",
      winnerId: "arg",
    });

    // Now test clicking when winner is already selected:
    // Update match state so Argentina is winner
    state.knockoutMatches["R32-73"].winnerId = "arg";
    state.knockoutMatches["R32-73"].loserId = "bra";

    rerender(
      <KnockoutBracket mode="editable" state={state} dispatch={dispatch} />,
    );

    // Click Argentina again to clear winner
    const newArgButton = screen.getByRole("button", { name: /argentina/i });
    await userEvent.click(newArgButton);
    expect(dispatch).toHaveBeenCalledWith({
      type: "CLEAR_KNOCKOUT_WINNER",
      matchId: "R32-73",
    });
  });

  it("respects readOnly and disables interactions", async () => {
    const state = createInitialState(null, null);

    // Clear all matches to avoid duplicate teams in other default slots
    for (const matchId of Object.keys(state.knockoutMatches)) {
      state.knockoutMatches[matchId] = {
        id: matchId,
        round: state.knockoutMatches[matchId].round,
        team1Id: null,
        team2Id: null,
        winnerId: null,
        loserId: null,
      };
    }

    state.knockoutMatches["R32-73"] = {
      id: "R32-73",
      round: "R32",
      team1Id: "arg",
      team2Id: "bra",
      winnerId: null,
      loserId: null,
    };

    const dispatch = vi.fn();

    render(
      <KnockoutBracket
        mode="editable"
        state={state}
        dispatch={dispatch}
        readOnly={true}
      />,
    );

    const argButton = screen.getByRole("button", { name: /argentina/i });
    expect(argButton).toBeDisabled();

    await userEvent.click(argButton);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("renders empty slots as TBD", () => {
    const state = createInitialState(null, null);

    // Clear all matches
    for (const matchId of Object.keys(state.knockoutMatches)) {
      state.knockoutMatches[matchId] = {
        id: matchId,
        round: state.knockoutMatches[matchId].round,
        team1Id: null,
        team2Id: null,
        winnerId: null,
        loserId: null,
      };
    }

    render(
      <KnockoutBracket mode="editable" state={state} dispatch={vi.fn()} />,
    );

    // TBD slots should be rendered (non-button divs or elements with TBD text)
    const tbdElements = screen.getAllByText("TBD");
    expect(tbdElements.length).toBeGreaterThan(0);
  });
});
