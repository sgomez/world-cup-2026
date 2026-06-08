import { render, screen } from "@testing-library/react";
import { notFound } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import PeerBetPage from "./page";

const { mockPrisma, mockIsClosed } = vi.hoisted(() => {
  return {
    mockPrisma: {
      community: {
        findUnique: vi.fn(),
      },
      bet: {
        findUnique: vi.fn(),
      },
    },
    mockIsClosed: vi.fn(),
  };
});

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

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
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

vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
  getTranslations: vi.fn().mockImplementation((namespace) => {
    return Promise.resolve((key: string, values?: any) => {
      if (values?.name) return `${key} ${values.name}`;
      if (values?.date) return `${key} ${values.date}`;
      return key;
    });
  }),
}));

vi.mock("@/components/bet-prediction", () => ({
  BetPrediction: ({
    betId,
    isOwner,
    headerDescription,
  }: {
    betId: string;
    isOwner: boolean;
    headerDescription?: React.ReactNode;
  }) => (
    <div
      data-testid="bet-prediction"
      data-bet-id={betId}
      data-is-owner={isOwner ? "true" : "false"}
    >
      <div>BetPrediction Component</div>
      <div data-testid="header-desc-wrapper">{headerDescription}</div>
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
    vi.mocked(prisma.community.findUnique).mockResolvedValue(null);

    await expect(PeerBetPage({ params: mockParams })).rejects.toThrow(
      "NOT_FOUND_TRIGGERED",
    );
    expect(notFound).toHaveBeenCalled();
  });

  it("raises notFound() if the viewer is not a member of the community", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "viewer-1" },
    } as any);
    vi.mocked(prisma.community.findUnique).mockResolvedValue({
      id: "comm-1",
      slug: "our-community",
      members: [
        { userId: "other-user", user: { id: "other-user", name: "Other" } },
      ],
    } as any);

    await expect(PeerBetPage({ params: mockParams })).rejects.toThrow(
      "NOT_FOUND_TRIGGERED",
    );
    expect(notFound).toHaveBeenCalled();
  });

  it("raises notFound() if the bet does not exist", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "viewer-1" },
    } as any);
    vi.mocked(prisma.community.findUnique).mockResolvedValue({
      id: "comm-1",
      slug: "our-community",
      members: [
        { userId: "viewer-1", user: { id: "viewer-1", name: "Viewer" } },
      ],
    } as any);
    vi.mocked(prisma.bet.findUnique).mockResolvedValue(null);

    await expect(PeerBetPage({ params: mockParams })).rejects.toThrow(
      "NOT_FOUND_TRIGGERED",
    );
    expect(notFound).toHaveBeenCalled();
  });

  it("raises notFound() if the bet is in draft status", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "viewer-1" },
    } as any);
    vi.mocked(prisma.community.findUnique).mockResolvedValue({
      id: "comm-1",
      slug: "our-community",
      members: [
        { userId: "viewer-1", user: { id: "viewer-1", name: "Viewer" } },
        { userId: "owner-1", user: { id: "owner-1", name: "Owner" } },
      ],
    } as any);
    vi.mocked(prisma.bet.findUnique).mockResolvedValue({
      id: "bet-1",
      userId: "owner-1",
      label: "Draft Bet",
      status: "draft",
      groupPredictions: null,
      knockoutWinners: {},
    } as any);

    await expect(PeerBetPage({ params: mockParams })).rejects.toThrow(
      "NOT_FOUND_TRIGGERED",
    );
    expect(notFound).toHaveBeenCalled();
  });

  it("raises notFound() if the bet owner is not in the community", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "viewer-1" },
    } as any);
    vi.mocked(prisma.community.findUnique).mockResolvedValue({
      id: "comm-1",
      slug: "our-community",
      members: [
        { userId: "viewer-1", user: { id: "viewer-1", name: "Viewer" } },
      ],
    } as any);
    vi.mocked(prisma.bet.findUnique).mockResolvedValue({
      id: "bet-1",
      userId: "owner-1",
      label: "Closed Bet",
      status: "closed",
      groupPredictions: null,
      knockoutWinners: {},
    } as any);

    await expect(PeerBetPage({ params: mockParams })).rejects.toThrow(
      "NOT_FOUND_TRIGGERED",
    );
    expect(notFound).toHaveBeenCalled();
  });

  it("renders 'hidden until deadline' gate page if accessed before the deadline", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "viewer-1" },
    } as any);
    vi.mocked(prisma.community.findUnique).mockResolvedValue({
      id: "comm-1",
      slug: "our-community",
      name: "Our Community",
      members: [
        { userId: "viewer-1", user: { id: "viewer-1", name: "Viewer" } },
        { userId: "owner-1", user: { id: "owner-1", name: "Owner" } },
      ],
    } as any);
    vi.mocked(prisma.bet.findUnique).mockResolvedValue({
      id: "bet-1",
      userId: "owner-1",
      label: "My Great Bet",
      status: "closed",
      groupPredictions: null,
      knockoutWinners: {},
    } as any);

    mockIsClosed.mockReturnValue(false); // before deadline

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

  it("renders read-only prediction stage if accessed after the deadline", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "viewer-1" },
    } as any);
    vi.mocked(prisma.community.findUnique).mockResolvedValue({
      id: "comm-1",
      slug: "our-community",
      name: "Our Community",
      members: [
        { userId: "viewer-1", user: { id: "viewer-1", name: "Viewer" } },
        { userId: "owner-1", user: { id: "owner-1", name: "Owner" } },
      ],
    } as any);
    vi.mocked(prisma.bet.findUnique).mockResolvedValue({
      id: "bet-1",
      userId: "owner-1",
      label: "My Great Bet",
      status: "closed",
      groupPredictions: null,
      knockoutWinners: {},
    } as any);

    mockIsClosed.mockReturnValue(true); // after deadline

    const result = await PeerBetPage({ params: mockParams });
    render(result);

    // Prediction container should be rendered
    const predictionComp = screen.getByTestId("bet-prediction");
    expect(predictionComp).toBeInTheDocument();
    expect(predictionComp.getAttribute("data-bet-id")).toBe("bet-1");
    expect(predictionComp.getAttribute("data-is-owner")).toBe("false");

    // Header description wrapper should contain owner name
    const headerWrapper = screen.getByTestId("header-desc-wrapper");
    expect(headerWrapper).toBeInTheDocument();
    expect(headerWrapper.textContent).toContain("Owner");

    // Back link check
    const backLink = screen.getByTestId("link");
    expect(backLink).toBeInTheDocument();
    expect(backLink.getAttribute("href")).toBe("/communities/our-community");
    expect(backLink.textContent).toContain("backTo Our Community");
  });
});
