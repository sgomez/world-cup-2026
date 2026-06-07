import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { closeBet, reopenBet } from "@/app/actions/bets";
import type { KnockoutMatch } from "@/lib/prediction-state";
import { BetPrediction } from "./bet-prediction";

vi.mock("next-intl", () => ({
  useLocale: vi.fn(() => "en"),
  useTranslations: vi.fn((namespace) => {
    return (key: string, values?: Record<string, unknown>) => {
      if (namespace === "bets") {
        if (key === "incompleteDescription") {
          return `You have predicted ${values?.predicted} of ${values?.total} knockout matches.`;
        }
        return (
          {
            closeBet: "Close bet",
            reopenBet: "Re-open bet",
            incompleteTitle: "Incomplete Predictions",
            ok: "OK",
            groupStageTab: "Group Stage",
            knockoutStageTab: "Knockout Stage",
            scoreTab: "Score",
            closeConfirmTitle: "Close bet?",
            closeConfirmDescription:
              "Closing your bet locks your predictions. You will not be able to edit them unless you re-open the bet before the deadline.",
            closeConfirmAction: "Close bet",
            cancel: "Cancel",
            groupChangeWarningTitle: "Reset knockout predictions?",
            groupChangeWarningDescription:
              "Changing standings will reset conflicting predictions in your knockout stage bracket.",
            groupChangeWarningConfirm: "Confirm",
          }[key] ?? key
        );
      }
      return key;
    };
  }),
}));

vi.mock("@/app/actions/bets", () => ({
  closeBet: vi.fn(),
  reopenBet: vi.fn(),
  updateBetPredictions: vi.fn(),
}));

vi.mock("@/components/group-stage", () => {
  const React = require("react");
  return {
    GroupStage: ({
      dispatch,
    }: {
      state: unknown;
      dispatch: (action: {
        type: string;
        groupName?: string;
        orderedIds?: string[];
      }) => void;
      readOnly?: boolean;
    }) => {
      const [status, setStatus] = React.useState("clean");
      return (
        <div data-testid="mock-group-stage">
          <span data-testid="group-stage-status">{status}</span>
          <button
            type="button"
            data-testid="make-dirty-btn"
            onClick={() => setStatus("dirty")}
          >
            Make Dirty
          </button>
          <button
            type="button"
            data-testid="reorder-group-btn"
            onClick={() =>
              dispatch({
                type: "SET_GROUP_ORDER",
                groupName: "A",
                orderedIds: ["team-2", "team-1", "team-3", "team-4"],
              })
            }
          >
            Reorder Group A
          </button>
        </div>
      );
    },
  };
});

vi.mock("@/components/knockout-stage", () => {
  const React = require("react");
  return {
    KnockoutStage: ({
      dispatch,
    }: {
      state: unknown;
      dispatch: (action: {
        type: string;
        matchId?: string;
        winnerId?: string;
      }) => void;
      readOnly?: boolean;
    }) =>
      React.createElement(
        "div",
        { "data-testid": "mock-knockout-stage" },
        React.createElement(
          "button",
          {
            type: "button",
            "data-testid": "set-knockout-winner-btn",
            onClick: () =>
              dispatch({
                type: "SET_KNOCKOUT_WINNER",
                matchId: "R32-73",
                winnerId: "team-1",
              }),
          },
          "Set Knockout Winner",
        ),
        React.createElement(
          "button",
          {
            type: "button",
            "data-testid": "clear-knockout-winner-btn",
            onClick: () =>
              dispatch({ type: "CLEAR_KNOCKOUT_WINNER", matchId: "R32-73" }),
          },
          "Clear Knockout Winner",
        ),
      ),
  };
});

vi.mock("@/lib/prediction-state", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/prediction-state")>();
  return {
    ...actual,
    createInitialState: vi.fn((saved, knockoutWinners) => {
      const state = actual.createInitialState(saved, knockoutWinners);
      if (knockoutWinners && Object.keys(knockoutWinners).length > 0) {
        const mockedMatches = { ...state.knockoutMatches };
        for (const [matchId, winnerId] of Object.entries(knockoutWinners)) {
          mockedMatches[matchId] = {
            id: matchId,
            round: "R32",
            team1Id: "team-a",
            team2Id: "team-b",
            winnerId,
            loserId: null,
          } as unknown as KnockoutMatch;
        }
        return {
          ...state,
          knockoutMatches: mockedMatches,
        };
      }
      return state;
    }),
  };
});

describe("BetPrediction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders tabs and page header with close action", () => {
    render(
      <BetPrediction
        betId="bet-1"
        betLabel="My test bet"
        isOwner={true}
        isPastDeadline={false}
        isClosed={false}
        savedPredictions={null}
        savedKnockoutWinners={null}
      />,
    );

    expect(screen.getByText("My test bet")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Close bet" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Group Stage")).toBeInTheDocument();
  });

  it("clicks close bet with incomplete predictions showing the warning modal", async () => {
    render(
      <BetPrediction
        betId="bet-1"
        betLabel="My test bet"
        isOwner={true}
        isPastDeadline={false}
        isClosed={false}
        savedPredictions={null}
        savedKnockoutWinners={null}
      />,
    );

    const closeBtn = screen.getByRole("button", { name: "Close bet" });
    await userEvent.click(closeBtn);

    // Modal should be open
    expect(screen.getByText("Incomplete Predictions")).toBeInTheDocument();
    expect(
      screen.getByText("You have predicted 0 of 32 knockout matches."),
    ).toBeInTheDocument();

    const okBtn = screen.getByRole("button", { name: "OK" });
    await userEvent.click(okBtn);

    // Modal should close
    expect(
      screen.queryByText("Incomplete Predictions"),
    ).not.toBeInTheDocument();
    expect(closeBet).not.toHaveBeenCalled();
  });

  it("clicks close bet with complete predictions, displays the confirmation modal", async () => {
    const completeWinners = Object.fromEntries(
      Array.from({ length: 32 }, (_, i) => [`M${i}`, `team-${i}`]),
    );

    render(
      <BetPrediction
        betId="bet-1"
        betLabel="My test bet"
        isOwner={true}
        isPastDeadline={false}
        isClosed={false}
        savedPredictions={null}
        savedKnockoutWinners={completeWinners}
      />,
    );

    const closeBtn = screen.getByRole("button", { name: "Close bet" });
    await userEvent.click(closeBtn);

    // Confirmation modal should be open
    expect(screen.getByText("Close bet?")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Closing your bet locks your predictions. You will not be able to edit them unless you re-open the bet before the deadline.",
      ),
    ).toBeInTheDocument();
    expect(closeBet).not.toHaveBeenCalled();
  });

  it("clicks Cancel inside confirmation modal, closes modal without calling closeBet", async () => {
    const completeWinners = Object.fromEntries(
      Array.from({ length: 32 }, (_, i) => [`M${i}`, `team-${i}`]),
    );

    render(
      <BetPrediction
        betId="bet-1"
        betLabel="My test bet"
        isOwner={true}
        isPastDeadline={false}
        isClosed={false}
        savedPredictions={null}
        savedKnockoutWinners={completeWinners}
      />,
    );

    const closeBtn = screen.getByRole("button", { name: "Close bet" });
    await userEvent.click(closeBtn);

    // Click Cancel
    const cancelBtn = screen.getByRole("button", { name: "Cancel" });
    await userEvent.click(cancelBtn);

    // Modal should close
    expect(screen.queryByText("Close bet?")).not.toBeInTheDocument();
    expect(closeBet).not.toHaveBeenCalled();
  });

  it("clicks Close bet inside confirmation modal, successfully calls closeBet", async () => {
    const completeWinners = Object.fromEntries(
      Array.from({ length: 32 }, (_, i) => [`M${i}`, `team-${i}`]),
    );

    vi.mocked(closeBet).mockResolvedValue({ success: true });

    render(
      <BetPrediction
        betId="bet-1"
        betLabel="My test bet"
        isOwner={true}
        isPastDeadline={false}
        isClosed={false}
        savedPredictions={null}
        savedKnockoutWinners={completeWinners}
      />,
    );

    const closeBtn = screen.getByRole("button", { name: "Close bet" });
    await userEvent.click(closeBtn);

    // The dialog close button is the only accessible button with name "Close bet"
    // when the dialog is open because the header button is marked as inert/hidden.
    const dialogConfirmBtn = screen.getByRole("button", { name: "Close bet" });
    await userEvent.click(dialogConfirmBtn);

    expect(closeBet).toHaveBeenCalledWith("bet-1");
  });

  it("reopens closed bet when clicking reopen", async () => {
    vi.mocked(reopenBet).mockResolvedValue({ success: true });

    render(
      <BetPrediction
        betId="bet-1"
        betLabel="My test bet"
        isOwner={true}
        isPastDeadline={false}
        isClosed={true}
        savedPredictions={null}
        savedKnockoutWinners={null}
      />,
    );

    const reopenBtn = screen.getByRole("button", { name: "Re-open bet" });
    await userEvent.click(reopenBtn);

    expect(reopenBet).toHaveBeenCalledWith("bet-1");
  });

  it("reordering group standings when NO knockout predictions exist does not show warning and dispatches immediately", async () => {
    render(
      <BetPrediction
        betId="bet-1"
        betLabel="My test bet"
        isOwner={true}
        isPastDeadline={false}
        isClosed={false}
        savedPredictions={null}
        savedKnockoutWinners={null}
      />,
    );

    const makeDirtyBtn = screen.getByTestId("make-dirty-btn");
    await userEvent.click(makeDirtyBtn);
    expect(screen.getByTestId("group-stage-status")).toHaveTextContent("dirty");

    const reorderBtn = screen.getByTestId("reorder-group-btn");
    await userEvent.click(reorderBtn);

    // Warning dialog should NOT show
    expect(
      screen.queryByText("Reset knockout predictions?"),
    ).not.toBeInTheDocument();

    // Status should still be "dirty" because it did not remount
    expect(screen.getByTestId("group-stage-status")).toHaveTextContent("dirty");
  });

  it("reordering group standings with knockout predictions shows warning dialog; clicking cancel reverts state", async () => {
    const completeWinners = Object.fromEntries(
      Array.from({ length: 32 }, (_, i) => [`M${i}`, `team-${i}`]),
    );

    render(
      <BetPrediction
        betId="bet-1"
        betLabel="My test bet"
        isOwner={true}
        isPastDeadline={false}
        isClosed={false}
        savedPredictions={null}
        savedKnockoutWinners={completeWinners}
      />,
    );

    const makeDirtyBtn = screen.getByTestId("make-dirty-btn");
    await userEvent.click(makeDirtyBtn);
    expect(screen.getByTestId("group-stage-status")).toHaveTextContent("dirty");

    const reorderBtn = screen.getByTestId("reorder-group-btn");
    await userEvent.click(reorderBtn);

    // Warning dialog should show
    expect(screen.getByText("Reset knockout predictions?")).toBeInTheDocument();

    // Click Cancel
    const cancelBtn = screen.getByRole("button", { name: "Cancel" });
    await userEvent.click(cancelBtn);

    // Dialog should close
    expect(
      screen.queryByText("Reset knockout predictions?"),
    ).not.toBeInTheDocument();

    // Status should reset to "clean" because the component remounted
    expect(screen.getByTestId("group-stage-status")).toHaveTextContent("clean");
  });

  it("reordering group standings with knockout predictions shows warning dialog; clicking confirm applies change", async () => {
    const completeWinners = Object.fromEntries(
      Array.from({ length: 32 }, (_, i) => [`M${i}`, `team-${i}`]),
    );

    render(
      <BetPrediction
        betId="bet-1"
        betLabel="My test bet"
        isOwner={true}
        isPastDeadline={false}
        isClosed={false}
        savedPredictions={null}
        savedKnockoutWinners={completeWinners}
      />,
    );

    const makeDirtyBtn = screen.getByTestId("make-dirty-btn");
    await userEvent.click(makeDirtyBtn);
    expect(screen.getByTestId("group-stage-status")).toHaveTextContent("dirty");

    const reorderBtn = screen.getByTestId("reorder-group-btn");
    await userEvent.click(reorderBtn);

    // Warning dialog should show
    expect(screen.getByText("Reset knockout predictions?")).toBeInTheDocument();

    // Click Confirm
    const confirmBtn = screen.getByRole("button", { name: "Confirm" });
    await userEvent.click(confirmBtn);

    // Dialog should close
    expect(
      screen.queryByText("Reset knockout predictions?"),
    ).not.toBeInTheDocument();

    // Status should still be "dirty" because it did NOT remount (reorder was applied, key did not change)
    expect(screen.getByTestId("group-stage-status")).toHaveTextContent("dirty");
  });

  it("warning does NOT appear when localStorage flag is false, even with knockout predictions", async () => {
    localStorage.setItem("knockout-warning-bet-1", "false");

    const completeWinners = Object.fromEntries(
      Array.from({ length: 32 }, (_, i) => [`M${i}`, `team-${i}`]),
    );

    render(
      <BetPrediction
        betId="bet-1"
        betLabel="My test bet"
        isOwner={true}
        isPastDeadline={false}
        isClosed={false}
        savedPredictions={null}
        savedKnockoutWinners={completeWinners}
      />,
    );

    const reorderBtn = screen.getByTestId("reorder-group-btn");
    await userEvent.click(reorderBtn);

    expect(
      screen.queryByText("Reset knockout predictions?"),
    ).not.toBeInTheDocument();
  });

  it("dispatching SET_KNOCKOUT_WINNER sets flag to true; subsequent group reorder shows warning", async () => {
    render(
      <BetPrediction
        betId="bet-1"
        betLabel="My test bet"
        isOwner={true}
        isPastDeadline={false}
        isClosed={false}
        savedPredictions={null}
        savedKnockoutWinners={null}
      />,
    );

    // No knockout winners initially — reorder should NOT trigger warning
    const reorderBtn = screen.getByTestId("reorder-group-btn");
    await userEvent.click(reorderBtn);
    expect(
      screen.queryByText("Reset knockout predictions?"),
    ).not.toBeInTheDocument();

    // Switch to knockout tab to dispatch SET_KNOCKOUT_WINNER
    await userEvent.click(screen.getByRole("tab", { name: "Knockout Stage" }));
    const setWinnerBtn = screen.getByTestId("set-knockout-winner-btn");
    await userEvent.click(setWinnerBtn);

    // Switch back to groups tab — reorder should now show warning
    await userEvent.click(screen.getByRole("tab", { name: "Group Stage" }));
    await userEvent.click(screen.getByTestId("reorder-group-btn"));
    expect(screen.getByText("Reset knockout predictions?")).toBeInTheDocument();
  });

  it("CLEAR_KNOCKOUT_WINNER when predictedCount drops to 0 sets flag to false; subsequent reorder shows no warning", async () => {
    render(
      <BetPrediction
        betId="bet-1"
        betLabel="My test bet"
        isOwner={true}
        isPastDeadline={false}
        isClosed={false}
        savedPredictions={null}
        savedKnockoutWinners={{ "R32-73": "team-x" }}
      />,
    );

    // Initially has 1 winner — reorder should show warning
    await userEvent.click(screen.getByTestId("reorder-group-btn"));
    expect(screen.getByText("Reset knockout predictions?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    // Switch to knockout tab and clear the winner
    await userEvent.click(screen.getByRole("tab", { name: "Knockout Stage" }));
    await userEvent.click(screen.getByTestId("clear-knockout-winner-btn"));

    // Switch back to groups tab — reorder should NOT show warning now
    await userEvent.click(screen.getByRole("tab", { name: "Group Stage" }));
    await userEvent.click(screen.getByTestId("reorder-group-btn"));
    expect(
      screen.queryByText("Reset knockout predictions?"),
    ).not.toBeInTheDocument();
  });

  it("confirming warning sets flag to false; subsequent group reorder shows no warning", async () => {
    const completeWinners = Object.fromEntries(
      Array.from({ length: 32 }, (_, i) => [`M${i}`, `team-${i}`]),
    );

    render(
      <BetPrediction
        betId="bet-1"
        betLabel="My test bet"
        isOwner={true}
        isPastDeadline={false}
        isClosed={false}
        savedPredictions={null}
        savedKnockoutWinners={completeWinners}
      />,
    );

    // First reorder — warning appears
    const reorderBtn = screen.getByTestId("reorder-group-btn");
    await userEvent.click(reorderBtn);
    expect(screen.getByText("Reset knockout predictions?")).toBeInTheDocument();

    // Confirm
    const confirmBtn = screen.getByRole("button", { name: "Confirm" });
    await userEvent.click(confirmBtn);
    expect(
      screen.queryByText("Reset knockout predictions?"),
    ).not.toBeInTheDocument();

    // Second reorder — warning should NOT appear again
    await userEvent.click(screen.getByTestId("reorder-group-btn"));
    expect(
      screen.queryByText("Reset knockout predictions?"),
    ).not.toBeInTheDocument();
  });

  it("flag is scoped to betId — unrelated bet's localStorage does not affect this bet", async () => {
    localStorage.setItem("knockout-warning-bet-1", "true");

    // Render bet-2 with no knockout winners
    render(
      <BetPrediction
        betId="bet-2"
        betLabel="Another bet"
        isOwner={true}
        isPastDeadline={false}
        isClosed={false}
        savedPredictions={null}
        savedKnockoutWinners={null}
      />,
    );

    // bet-2 has no winners, so flag initialises to false regardless of bet-1's localStorage
    const reorderBtn = screen.getByTestId("reorder-group-btn");
    await userEvent.click(reorderBtn);
    expect(
      screen.queryByText("Reset knockout predictions?"),
    ).not.toBeInTheDocument();
  });
});
