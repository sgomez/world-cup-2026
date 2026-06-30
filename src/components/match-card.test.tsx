import { composeStories } from "@storybook/react";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import enMessages from "../../messages/en.json";
import { MatchCard } from "./match-card";
import * as stories from "./match-card.stories";

const { Upcoming, Live, Finished, FinishedKnockout } = composeStories(stories);

vi.mock("@/modules/schedule", () => ({
  getKickoffInstant: vi.fn(() => ({
    match: (_ok: unknown, err: (e: string) => void) => err("mock"),
  })),
}));

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const defaultProps = {
  isKnockout: false,
  date: "2026-06-11",
  time: "19:00 UTC-5",
  team1: "Argentina",
  team2: "Canada",
  group: "A",
  ground: "MetLife Stadium, New Jersey",
  locale: "en",
  status: "FINISHED" as const,
  score1: "2",
  score2: "1",
};

describe("MatchCard", () => {
  it("shows goals in score boxes for a group-stage match", () => {
    renderWithIntl(
      <MatchCard {...defaultProps} isKnockout={false} score1="2" score2="1" />,
    );
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("does not show penalty badge when isKnockout is false", () => {
    renderWithIntl(
      <MatchCard
        {...defaultProps}
        isKnockout={false}
        score1="1"
        score2="1"
        penalties1={5}
        penalties2={3}
        status="FINISHED"
      />,
    );
    // Penalty values 5 and 3 should NOT appear
    expect(screen.queryByText("5")).not.toBeInTheDocument();
    expect(screen.queryByText("3")).not.toBeInTheDocument();
  });

  it("shows penalty badge on score box for a finished knockout match with penalties", () => {
    renderWithIntl(
      <MatchCard
        {...defaultProps}
        isKnockout={true}
        score1="1"
        score2="1"
        penalties1={5}
        penalties2={3}
        status="FINISHED"
      />,
    );
    // Goal scores appear
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
    // Penalty values appear as badges
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("does not show penalty badge for an upcoming knockout match", () => {
    renderWithIntl(
      <MatchCard
        {...defaultProps}
        isKnockout={true}
        score1={undefined}
        score2={undefined}
        penalties1={undefined}
        penalties2={undefined}
        status="UPCOMING"
      />,
    );
    expect(screen.queryByText("5")).not.toBeInTheDocument();
    expect(screen.queryByText("3")).not.toBeInTheDocument();
  });

  it("does not show penalty badge for a live knockout match without penalties", () => {
    renderWithIntl(
      <MatchCard
        {...defaultProps}
        isKnockout={true}
        score1="0"
        score2="0"
        penalties1={undefined}
        penalties2={undefined}
        status="LIVE"
      />,
    );
    expect(screen.queryByText("5")).not.toBeInTheDocument();
  });

  it("shows penalty badge for a live knockout match when penalties are defined", () => {
    renderWithIntl(
      <MatchCard
        {...defaultProps}
        isKnockout={true}
        score1="1"
        score2="1"
        penalties1={4}
        penalties2={2}
        status="LIVE"
      />,
    );
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("shows penalty badge for an upcoming knockout match when penalties are defined", () => {
    renderWithIntl(
      <MatchCard
        {...defaultProps}
        isKnockout={true}
        score1="1"
        score2="1"
        penalties1={0}
        penalties2={0}
        status="UPCOMING"
      />,
    );
    expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(2);
  });

  it("applies grayscale class to team1 when t1Eliminated is true", () => {
    const { container } = renderWithIntl(
      <MatchCard
        {...defaultProps}
        isKnockout={true}
        score1="1"
        score2="2"
        t1Eliminated={true}
        t2Eliminated={false}
        status="FINISHED"
      />,
    );
    const grayscaleEls = container.querySelectorAll(".grayscale");
    expect(grayscaleEls.length).toBeGreaterThan(0);
  });

  it("applies grayscale class to team2 when t2Eliminated is true", () => {
    const { container } = renderWithIntl(
      <MatchCard
        {...defaultProps}
        isKnockout={true}
        score1="2"
        score2="1"
        t1Eliminated={false}
        t2Eliminated={true}
        status="FINISHED"
      />,
    );
    const grayscaleEls = container.querySelectorAll(".grayscale");
    expect(grayscaleEls.length).toBeGreaterThan(0);
  });

  it("does not apply grayscale for a group-stage match", () => {
    const { container } = renderWithIntl(
      <MatchCard
        {...defaultProps}
        isKnockout={false}
        t1Eliminated={false}
        t2Eliminated={false}
        status="FINISHED"
      />,
    );
    const grayscaleEls = container.querySelectorAll(".grayscale");
    expect(grayscaleEls.length).toBe(0);
  });

  it("renders no score box when score props are absent", () => {
    renderWithIntl(
      <MatchCard
        {...defaultProps}
        score1={undefined}
        score2={undefined}
        penalties1={undefined}
        penalties2={undefined}
        status="UPCOMING"
      />,
    );
    // Score values should not appear
    expect(screen.queryByText("2")).not.toBeInTheDocument();
    expect(screen.queryByText("1")).not.toBeInTheDocument();
  });
});

describe("MatchCard Composed Stories", () => {
  it("runs Upcoming story play function", async () => {
    await Upcoming.run();
  });

  it("runs Live story play function", async () => {
    await Live.run();
  });

  it("runs Finished story play function", async () => {
    await Finished.run();
  });

  it("runs FinishedKnockout story play function", async () => {
    await FinishedKnockout.run();
  });
});
