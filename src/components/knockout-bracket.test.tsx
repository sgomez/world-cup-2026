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
        finished: "Finished",
        live: "LIVE",
        upcoming: "Upcoming",
        winnerGroup: `Winner Group ${params?.group ?? ""}`,
        runnerUpGroup: `Runner-up Group ${params?.group ?? ""}`,
        bestThird: `Best 3rd ${params?.groups ?? ""}`,
        winnerMatch: `Winner Match ${params?.num ?? ""}`,
        loserMatch: `Loser Match ${params?.num ?? ""}`,
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

describe("KnockoutBracket - scored mode", () => {
  it("renders status variants, score + penalty display, winner/loser emphasis, and non-interactive slots", () => {
    // Construct a minimal bracketMatches Record
    const bracketMatches: Record<string, any> = {};

    // R32-73: Argentina vs TBD (Runner-up Group B), not started (will render as TBD status badge)
    bracketMatches["R32-73"] = {
      id: "R32-73",
      round: "R32",
      team1Id: "arg",
      team2Id: null,
      winnerId: null,
      loserId: null,
    };

    // R32-74: Argentina vs Brazil, Argentina won
    bracketMatches["R32-74"] = {
      id: "R32-74",
      round: "R32",
      team1Id: "arg",
      team2Id: "bra",
      winnerId: "arg",
      loserId: "bra",
    };

    // R32-75: Mexico vs Canada, live
    bracketMatches["R32-75"] = {
      id: "R32-75",
      round: "R32",
      team1Id: "mex",
      team2Id: "can",
      winnerId: null,
      loserId: null,
    };

    // R32-76: USA vs Canada, upcoming (both teams resolved, will render as Upcoming status badge)
    bracketMatches["R32-76"] = {
      id: "R32-76",
      round: "R32",
      team1Id: "usa",
      team2Id: "can",
      winnerId: null,
      loserId: null,
    };

    const liveResults = [
      { num: 73, status: "upcoming" },
      {
        num: 74,
        status: "finished",
        goals1: 2,
        goals2: 1,
        penalties1: 3,
        penalties2: 1,
      },
      { num: 75, status: "live", goals1: 3, goals2: 2 },
      { num: 76, status: "upcoming" },
    ];

    render(
      <KnockoutBracket
        mode="scored"
        bracketMatches={bracketMatches}
        liveResults={liveResults}
      />,
    );

    // 1. Verify Status variants
    expect(screen.getByText("Finished")).toBeInTheDocument();
    expect(screen.getByText("LIVE")).toBeInTheDocument();
    expect(screen.getByText("Upcoming")).toBeInTheDocument();

    // 2. Verify Score + Penalty display
    expect(screen.getAllByText("2").length).toBeGreaterThan(0);
    expect(screen.getByText("(3)")).toBeInTheDocument();
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
    expect(screen.getByText("(1)")).toBeInTheDocument();

    expect(screen.getAllByText("3").length).toBeGreaterThan(0);

    // 3. Verify Placeholder labels render for unresolved slot in R32-73 (side 2 / 2B)
    expect(screen.getByText("Runner-up Group B")).toBeInTheDocument();

    // 4. Verify winner/loser emphasis and non-interactive slots
    // Buttons for choosing winners should not exist
    const buttons = screen.queryAllByRole("button");
    expect(buttons.length).toBe(0);
  });
});
