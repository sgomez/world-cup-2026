import { composeStories } from "@storybook/react";
import { render, screen } from "@testing-library/react";
import { Users } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import {
  GroupStandingsCard,
  type GroupStandingsRow,
} from "./group-standings-card";
import * as stories from "./group-standings-card.stories";

vi.mock("next-intl", () => ({
  useTranslations: vi.fn(() => (key: string) => {
    const map: Record<string, string> = {
      pos: "#",
      team: "Team",
      mp: "MP",
      pts: "PTS",
      gf: "GF",
      ga: "GA",
      gd: "GD",
      liveMarker: "LIVE",
    };
    return map[key] ?? key;
  }),
}));

const { Default, WithLiveMarker, BestThirdsVariant, UnqualifiedRowsGrayscale } =
  composeStories(stories);

const mockRow = (
  overrides: Partial<GroupStandingsRow> = {},
): GroupStandingsRow => ({
  teamId: "arg",
  position: 1,
  mp: 3,
  pts: 9,
  gf: 7,
  ga: 2,
  gd: 5,
  qualified: true,
  team: { id: "arg", name: "Argentina", flag: "🇦🇷", code: "ar" },
  ...overrides,
});

const mockRows: GroupStandingsRow[] = [
  mockRow(),
  mockRow({
    teamId: "bra",
    position: 2,
    pts: 6,
    gf: 5,
    ga: 3,
    gd: 2,
    team: { id: "bra", name: "Brazil", flag: "🇧🇷", code: "br" },
  }),
];

describe("GroupStandingsCard", () => {
  it("renders title and qualifyLabel", () => {
    render(
      <GroupStandingsCard
        title="Group A"
        qualifyLabel="3 qualify from 4"
        rows={mockRows}
        liveTeamIds={new Set()}
      />,
    );
    expect(screen.getByText("Group A")).toBeInTheDocument();
    expect(screen.getByText("3 qualify from 4")).toBeInTheDocument();
  });

  it("renders all row team names", () => {
    render(
      <GroupStandingsCard
        title="Group A"
        qualifyLabel="3 qualify from 4"
        rows={mockRows}
        liveTeamIds={new Set()}
      />,
    );
    expect(screen.getByText("Argentina")).toBeInTheDocument();
    expect(screen.getByText("Brazil")).toBeInTheDocument();
  });

  it("renders MP column header", () => {
    render(
      <GroupStandingsCard
        title="Group A"
        qualifyLabel="3 qualify from 4"
        rows={mockRows}
        liveTeamIds={new Set()}
      />,
    );
    expect(
      screen.getByRole("columnheader", { name: "MP" }),
    ).toBeInTheDocument();
  });

  it("renders LIVE marker for teams in liveTeamIds", () => {
    render(
      <GroupStandingsCard
        title="Group A"
        qualifyLabel="3 qualify from 4"
        rows={mockRows}
        liveTeamIds={new Set(["arg"])}
      />,
    );
    expect(screen.getByText("LIVE")).toBeInTheDocument();
  });

  it("does not render LIVE marker when no teams are live", () => {
    render(
      <GroupStandingsCard
        title="Group A"
        qualifyLabel="3 qualify from 4"
        rows={mockRows}
        liveTeamIds={new Set()}
      />,
    );
    expect(screen.queryByText("LIVE")).not.toBeInTheDocument();
  });

  it("renders rowSuffix content for each row", () => {
    const rows = [
      mockRow(),
      mockRow({
        teamId: "bra",
        position: 2,
        pts: 6,
        gf: 5,
        ga: 3,
        gd: 2,
        team: { id: "bra", name: "Brazil", flag: "🇧🇷", code: "br" },
      }),
    ];
    render(
      <GroupStandingsCard
        title="Best Thirds"
        qualifyLabel="8 qualify"
        rows={rows}
        liveTeamIds={new Set()}
        rowSuffix={(row) => <span>{row.teamId === "arg" ? "(A)" : "(B)"}</span>}
      />,
    );
    expect(screen.getByText("(A)")).toBeInTheDocument();
    expect(screen.getByText("(B)")).toBeInTheDocument();
  });

  it("applies grayscale class to unqualified rows", () => {
    const rows = [
      mockRow({ qualified: true }),
      mockRow({
        teamId: "bra",
        position: 2,
        pts: 0,
        gf: 0,
        ga: 3,
        gd: -3,
        qualified: false,
        team: { id: "bra", name: "Brazil", flag: "🇧🇷", code: "br" },
      }),
    ];
    const { container } = render(
      <GroupStandingsCard
        title="Group A"
        qualifyLabel="1 qualify"
        rows={rows}
        liveTeamIds={new Set()}
      />,
    );
    const tableRows = container.querySelectorAll("tbody tr");
    expect(tableRows[0].className).not.toContain("grayscale");
    expect(tableRows[1].className).toContain("grayscale");
  });

  it("renders titleIcon when provided", () => {
    const { container } = render(
      <GroupStandingsCard
        title="Best Thirds"
        titleIcon={<Users data-testid="users-icon" />}
        qualifyLabel="8 qualify"
        rows={mockRows}
        liveTeamIds={new Set()}
      />,
    );
    expect(
      container.querySelector('[data-testid="users-icon"]'),
    ).toBeInTheDocument();
  });

  it("renders positive gd with + prefix", () => {
    render(
      <GroupStandingsCard
        title="Group A"
        qualifyLabel="3 qualify from 4"
        rows={[mockRow({ gd: 5 })]}
        liveTeamIds={new Set()}
      />,
    );
    expect(screen.getByText("+5")).toBeInTheDocument();
  });

  it("renders negative gd without + prefix", () => {
    render(
      <GroupStandingsCard
        title="Group A"
        qualifyLabel="3 qualify from 4"
        rows={[mockRow({ gd: -3, qualified: false })]}
        liveTeamIds={new Set()}
      />,
    );
    expect(screen.getByText("-3")).toBeInTheDocument();
  });
});

describe("GroupStandingsCard Composed Stories", () => {
  it("runs Default story play function", async () => {
    await Default.run();
  });

  it("runs WithLiveMarker story play function", async () => {
    await WithLiveMarker.run();
  });

  it("runs BestThirdsVariant story play function", async () => {
    await BestThirdsVariant.run();
  });

  it("runs UnqualifiedRowsGrayscale story play function", async () => {
    await UnqualifiedRowsGrayscale.run();
  });
});
