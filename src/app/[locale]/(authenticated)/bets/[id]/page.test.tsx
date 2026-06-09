import { render, screen } from "@testing-library/react";
import { notFound } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "@/i18n/navigation";
import { getSession } from "@/lib/session";
import BetPage from "./page";

const mockFindById = vi.fn();

vi.mock("@/lib/session", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/modules/bet/infrastructure/prisma-bet-repository", () => {
  return {
    PrismaBetRepository: class {
      findById = mockFindById;
    },
  };
});

vi.mock(
  "@/modules/tournament/infrastructure/prisma-tournament-repository",
  () => {
    return {
      PrismaTournamentRepository: class {
        get = vi.fn().mockResolvedValue(null);
      },
    };
  },
);

vi.mock(
  "@/modules/tournament/application/get-actual-scoreable-content",
  () => ({
    getActualScoreableContent: vi.fn().mockResolvedValue({
      R32: [],
      R16: [],
      QF: [],
      SF: [],
      F: [],
      champion: null,
      thirdPlace: null,
    }),
  }),
);

vi.mock("next/navigation", () => ({
  notFound: vi.fn().mockImplementation(() => {
    throw new Error("NOT_FOUND_TRIGGERED");
  }),
}));

vi.mock("@/i18n/navigation", () => ({
  redirect: vi.fn().mockImplementation(() => {
    throw new Error("REDIRECT_TRIGGERED");
  }),
}));

vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
}));

vi.mock("@/components/bet-prediction", () => ({
  BetPrediction: ({ betId, isOwner }: { betId: string; isOwner: boolean }) => (
    <div
      data-testid="bet-prediction"
      data-bet-id={betId}
      data-is-owner={isOwner ? "true" : "false"}
    >
      BetPrediction Component
    </div>
  ),
}));

describe("BetPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to login if not authenticated", async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const params = Promise.resolve({ locale: "en", id: "bet-1" });
    await expect(BetPage({ params })).rejects.toThrow("REDIRECT_TRIGGERED");

    expect(redirect).toHaveBeenCalledWith({ href: "/login", locale: "en" });
  });

  it("raises notFound() if the bet does not exist", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "user-1" },
    } as never);

    mockFindById.mockResolvedValue(null);

    const params = Promise.resolve({ locale: "en", id: "bet-nonexistent" });

    await expect(BetPage({ params })).rejects.toThrow("NOT_FOUND_TRIGGERED");
    expect(notFound).toHaveBeenCalled();
  });

  it("raises notFound() if the authenticated user does not own the bet", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "user-2" }, // different user
    } as never);

    const mockBet = {
      id: "bet-1",
      userId: "user-1",
      isOwnedBy: (uid: string) => uid === "user-1",
      groupPredictions: null,
      knockoutWinners: {},
      status: "draft",
      label: "User 1 Bet",
    };

    mockFindById.mockResolvedValue(mockBet);

    const params = Promise.resolve({ locale: "en", id: "bet-1" });

    await expect(BetPage({ params })).rejects.toThrow("NOT_FOUND_TRIGGERED");
    expect(notFound).toHaveBeenCalled();
  });

  it("renders successfully if the authenticated user owns the bet", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "user-1" },
    } as never);

    const mockBet = {
      id: "bet-1",
      userId: "user-1",
      isOwnedBy: (uid: string) => uid === "user-1",
      groupPredictions: null,
      knockoutWinners: {},
      status: "draft",
      label: "User 1 Bet",
    };

    mockFindById.mockResolvedValue(mockBet);

    const params = Promise.resolve({ locale: "en", id: "bet-1" });
    const result = await BetPage({ params });

    render(result);

    const element = screen.getByTestId("bet-prediction");
    expect(element).toBeInTheDocument();
    expect(element.getAttribute("data-bet-id")).toBe("bet-1");
    expect(element.getAttribute("data-is-owner")).toBe("true");
    expect(notFound).not.toHaveBeenCalled();
  });
});
