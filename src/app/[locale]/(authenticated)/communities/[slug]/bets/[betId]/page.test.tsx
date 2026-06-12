import { render, screen } from "@testing-library/react";
import { err, ok } from "neverthrow";
import { notFound } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "@/i18n/navigation";
import { getSession } from "@/lib/session";
import { domainError } from "@/modules/bet/domain/errors";
import PeerBetPage from "./page";

const { mockGetPeerBet, mockIsClosed } = vi.hoisted(() => {
  return {
    mockGetPeerBet: vi.fn(),
    mockIsClosed: vi.fn(),
  };
});

vi.mock("@/modules/bet/application/get-peer-bet", () => ({
  getPeerBet: mockGetPeerBet,
}));

vi.mock("@/modules/bet/domain/betting-window", () => {
  return {
    BettingWindow: class {
      isClosed = mockIsClosed;
    },
  };
});

vi.mock("@/lib/session", () => ({
  getSession: vi.fn(),
}));

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

vi.mock("@/modules/live/infrastructure/prisma-live-result-repository", () => {
  return {
    PrismaLiveResultRepository: class {
      findAll = vi.fn().mockResolvedValue([]);
    },
  };
});

vi.mock(
  "@/modules/tournament/application/get-actual-scoreable-content",
  () => ({
    getActualScoreableContent: vi.fn().mockReturnValue({
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

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn().mockImplementation(() => {
    throw new Error("NOT_FOUND_TRIGGERED");
  }),
}));

vi.mock("@/i18n/navigation", () => ({
  redirect: vi.fn().mockImplementation(() => {
    throw new Error("REDIRECT_TRIGGERED");
  }),
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href} data-testid="link">
      {children}
    </a>
  ),
}));

vi.mock("next-intl/server", () => {
  const getTranslationsMock = vi.fn().mockImplementation(() => {
    const fn = (key: string, values?: any) => {
      if (values?.name) return `${key} ${values.name}`;
      if (values?.date) return `${key} ${values.date}`;
      return key;
    };
    fn.rich = (key: string, values?: any) => {
      if (values?.date) {
        const dateElement =
          typeof values.date === "function" ? values.date() : values.date;
        return (
          <>
            {key} {dateElement}
          </>
        );
      }
      return fn(key, values);
    };
    return Promise.resolve(fn);
  });
  return {
    setRequestLocale: vi.fn(),
    getTranslations: getTranslationsMock,
  };
});

vi.mock("@/components/local-date", () => ({
  LocalDate: ({ date }: { date: Date }) => {
    const utcStr = `${date.toISOString().replace("T", " ").substring(0, 16)} UTC`;
    return <>{utcStr}</>;
  },
}));

vi.mock("@/components/score-tab", () => ({
  ScoreTab: ({
    prediction,
    actualResults,
    hasLiveMatch,
  }: {
    prediction: any;
    actualResults: any;
    hasLiveMatch: boolean;
  }) => (
    <div
      data-testid="score-tab"
      data-prediction={JSON.stringify(prediction)}
      data-actual-results={JSON.stringify(actualResults)}
      data-has-live-match={hasLiveMatch ? "true" : "false"}
    >
      ScoreTab Component
    </div>
  ),
}));

describe("PeerBetPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockParams = Promise.resolve({
    locale: "en",
    slug: "our-community",
    betId: "bet-1",
  });

  const mockBet = {
    id: "bet-1",
    label: "My Great Bet",
    signature: "signature123",
    groupPredictions: null,
    knockoutWinners: {},
    scoreableContent: vi.fn().mockReturnValue({
      R32: new Set(),
      R16: new Set(),
      QF: new Set(),
      SF: new Set(),
      F: new Set(),
      champion: null,
      thirdPlace: null,
    }),
  } as any;

  it("redirects to login if not authenticated", async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    await expect(PeerBetPage({ params: mockParams })).rejects.toThrow(
      "REDIRECT_TRIGGERED",
    );
    expect(redirect).toHaveBeenCalledWith({ href: "/login", locale: "en" });
  });

  it("raises notFound() if the community does not exist", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "viewer-1" },
    } as any);
    mockGetPeerBet.mockResolvedValue(err(domainError("NOT_FOUND")));

    await expect(PeerBetPage({ params: mockParams })).rejects.toThrow(
      "NOT_FOUND_TRIGGERED",
    );
    expect(notFound).toHaveBeenCalled();
  });

  it("raises notFound() if the viewer is not a member of the community", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "viewer-1" },
    } as any);
    mockGetPeerBet.mockResolvedValue(err(domainError("FORBIDDEN")));

    await expect(PeerBetPage({ params: mockParams })).rejects.toThrow(
      "NOT_FOUND_TRIGGERED",
    );
    expect(notFound).toHaveBeenCalled();
  });

  it("raises notFound() if the bet does not exist", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "viewer-1" },
    } as any);
    mockGetPeerBet.mockResolvedValue(err(domainError("NOT_FOUND")));

    await expect(PeerBetPage({ params: mockParams })).rejects.toThrow(
      "NOT_FOUND_TRIGGERED",
    );
    expect(notFound).toHaveBeenCalled();
  });

  it("raises notFound() if the bet is in draft status", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "viewer-1" },
    } as any);
    mockGetPeerBet.mockResolvedValue(err(domainError("FORBIDDEN")));

    await expect(PeerBetPage({ params: mockParams })).rejects.toThrow(
      "NOT_FOUND_TRIGGERED",
    );
    expect(notFound).toHaveBeenCalled();
  });

  it("raises notFound() if the bet owner is not in the community", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "viewer-1" },
    } as any);
    mockGetPeerBet.mockResolvedValue(err(domainError("FORBIDDEN")));

    await expect(PeerBetPage({ params: mockParams })).rejects.toThrow(
      "NOT_FOUND_TRIGGERED",
    );
    expect(notFound).toHaveBeenCalled();
  });

  it("renders 'hidden until deadline' gate page if accessed before the deadline", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "viewer-1" },
    } as any);
    mockGetPeerBet.mockResolvedValue(
      ok({
        bet: mockBet,
        ownerName: "Owner",
        communityName: "Our Community",
        visibility: "summary",
      }),
    );

    const result = await PeerBetPage({ params: mockParams });
    render(result);

    // Title / Label check
    expect(screen.getByText("My Great Bet")).toBeInTheDocument();
    // Owner name check
    expect(screen.getByText("Owner")).toBeInTheDocument();
    // Gate page title and message
    expect(screen.getByText("gatePageTitle")).toBeInTheDocument();
    expect(
      screen.getByText("gateMessage 2026-06-11 19:00 UTC"),
    ).toBeInTheDocument();
    // Back link check
    const backLink = screen.getByTestId("link");
    expect(backLink).toBeInTheDocument();
    expect(backLink.getAttribute("href")).toBe("/communities/our-community");
    expect(backLink.textContent).toContain("backTo Our Community");
  });

  it("renders read-only score view if accessed after the deadline", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "viewer-1" },
    } as any);
    mockGetPeerBet.mockResolvedValue(
      ok({
        bet: mockBet,
        ownerName: "Owner",
        communityName: "Our Community",
        visibility: "full",
      }),
    );
    mockIsClosed.mockReturnValue(true);

    const result = await PeerBetPage({ params: mockParams });
    render(result);

    // ScoreTab container should be rendered
    const scoreTabComp = screen.getByTestId("score-tab");
    expect(scoreTabComp).toBeInTheDocument();

    // Page title and description should be rendered
    expect(screen.getByText("My Great Bet")).toBeInTheDocument();
    expect(screen.getByText("Owner")).toBeInTheDocument();

    // Back link check
    const backLink = screen.getByTestId("link");
    expect(backLink).toBeInTheDocument();
    expect(backLink.getAttribute("href")).toBe("/communities/our-community");
    expect(backLink.textContent).toContain("backTo Our Community");
  });

  it("renders ScoreTab with directPredictions for a Direct Bet", async () => {
    const directBet = {
      id: "bet-direct",
      label: "My Direct Bet",
      signature: "signatureDirect",
      groupPredictions: null,
      knockoutWinners: {},
      directPredictions: {
        R32: ["arg", "bra"],
        R16: ["arg"],
        QF: [],
        SF: [],
        F: [],
        champion: "arg",
        thirdPlace: "bra",
      },
      scoreableContent: vi.fn().mockReturnValue({
        R32: new Set(["ARG", "BRA"]),
        R16: new Set(["ARG"]),
        QF: new Set([]),
        SF: new Set([]),
        F: new Set([]),
        champion: "ARG",
        thirdPlace: "BRA",
      }),
    } as any;

    vi.mocked(getSession).mockResolvedValue({
      user: { id: "viewer-1" },
    } as any);
    mockGetPeerBet.mockResolvedValue(
      ok({
        bet: directBet,
        ownerName: "Owner",
        communityName: "Our Community",
        visibility: "full",
      }),
    );
    mockIsClosed.mockReturnValue(true);

    const result = await PeerBetPage({ params: mockParams });
    render(result);

    // ScoreTab should be rendered with the converted prediction from directPredictions
    const scoreTab = screen.getByTestId("score-tab");
    expect(scoreTab).toBeInTheDocument();
    const predictionData = JSON.parse(
      scoreTab.getAttribute("data-prediction") || "{}",
    );
    expect(predictionData.champion).toBe("ARG");
    expect(predictionData.R32).toEqual(["ARG", "BRA"]);
  });
});
