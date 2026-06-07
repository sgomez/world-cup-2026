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

vi.mock("@/lib/prediction-state", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/prediction-state")>();
  return {
    ...actual,
    createInitialState: vi.fn((saved, knockoutWinners) => {
      const state = actual.createInitialState(saved, knockoutWinners);
      if (knockoutWinners && Object.keys(knockoutWinners).length === 32) {
        const mockedMatches = { ...state.knockoutMatches };
        for (const [matchId, winnerId] of Object.entries(knockoutWinners)) {
          mockedMatches[matchId] = {
            id: matchId,
            round: "R32",
            team1Id: "a",
            team2Id: "b",
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

  it("clicks close bet with complete predictions, calls closeBet directly", async () => {
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

    // Modal should not open
    expect(
      screen.queryByText("Incomplete Predictions"),
    ).not.toBeInTheDocument();
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
});
