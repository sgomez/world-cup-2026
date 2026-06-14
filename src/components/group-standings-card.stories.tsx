import type { Meta, StoryObj } from "@storybook/react";
import { Users } from "lucide-react";
import { expect, within } from "storybook/test";
import { GroupStandingsCard } from "./group-standings-card";

const mockRows = [
  {
    teamId: "arg",
    position: 1,
    mp: 3,
    pts: 9,
    gf: 7,
    ga: 2,
    gd: 5,
    qualified: true,
    team: { id: "arg", name: "Argentina", flag: "🇦🇷", code: "ar" },
  },
  {
    teamId: "bra",
    position: 2,
    mp: 3,
    pts: 6,
    gf: 5,
    ga: 3,
    gd: 2,
    qualified: true,
    team: { id: "bra", name: "Brazil", flag: "🇧🇷", code: "br" },
  },
  {
    teamId: "mex",
    position: 3,
    mp: 3,
    pts: 3,
    gf: 2,
    ga: 4,
    gd: -2,
    qualified: false,
    team: { id: "mex", name: "Mexico", flag: "🇲🇽", code: "mx" },
  },
  {
    teamId: "uru",
    position: 4,
    mp: 3,
    pts: 0,
    gf: 1,
    ga: 6,
    gd: -5,
    qualified: false,
    team: { id: "uru", name: "Uruguay", flag: "🇺🇾", code: "uy" },
  },
];

const meta: Meta<typeof GroupStandingsCard> = {
  title: "Components/GroupStandingsCard",
  component: GroupStandingsCard,
  args: {
    title: "Group A",
    qualifyLabel: "3 qualify from 4",
    rows: mockRows,
    liveTeamIds: new Set(),
  },
};

export default meta;
type Story = StoryObj<typeof GroupStandingsCard>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Group A")).toBeInTheDocument();
    await expect(canvas.getByText("Argentina")).toBeInTheDocument();
    await expect(canvas.getByText("Brazil")).toBeInTheDocument();
    await expect(canvas.getByText("Mexico")).toBeInTheDocument();
    await expect(canvas.getByText("Uruguay")).toBeInTheDocument();
    await expect(canvas.getByText("3 qualify from 4")).toBeInTheDocument();
  },
};

export const WithLiveMarker: Story = {
  args: {
    liveTeamIds: new Set(["arg"]),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Group A")).toBeInTheDocument();
    await expect(canvas.getByText("Argentina")).toBeInTheDocument();
    // LIVE marker should appear next to Argentina
    await expect(canvas.getByText("LIVE")).toBeInTheDocument();
  },
};

export const BestThirdsVariant: Story = {
  args: {
    title: "Best Third-place Teams",
    titleIcon: <Users className="h-4 w-4 text-primary" />,
    qualifyLabel: "8 qualify",
    rows: [
      {
        teamId: "mex",
        position: 1,
        mp: 3,
        pts: 5,
        gf: 3,
        ga: 2,
        gd: 1,
        qualified: true,
        team: { id: "mex", name: "Mexico", flag: "🇲🇽", code: "mx" },
      },
      {
        teamId: "uru",
        position: 2,
        mp: 3,
        pts: 4,
        gf: 2,
        ga: 2,
        gd: 0,
        qualified: true,
        team: { id: "uru", name: "Uruguay", flag: "🇺🇾", code: "uy" },
      },
    ],
    rowSuffix: (row: { teamId: string }) =>
      row.teamId === "mex" ? (
        <span className="text-[9px] uppercase font-bold text-mute dark:text-stone shrink-0">
          (A)
        </span>
      ) : (
        <span className="text-[9px] uppercase font-bold text-mute dark:text-stone shrink-0">
          (B)
        </span>
      ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("Best Third-place Teams"),
    ).toBeInTheDocument();
    await expect(canvas.getByText("Mexico")).toBeInTheDocument();
    await expect(canvas.getByText("Uruguay")).toBeInTheDocument();
    await expect(canvas.getByText("(A)")).toBeInTheDocument();
    await expect(canvas.getByText("(B)")).toBeInTheDocument();
  },
};

export const UnqualifiedRowsGrayscale: Story = {
  args: {
    rows: [
      {
        teamId: "arg",
        position: 1,
        mp: 3,
        pts: 9,
        gf: 7,
        ga: 2,
        gd: 5,
        qualified: true,
        team: { id: "arg", name: "Argentina", flag: "🇦🇷", code: "ar" },
      },
      {
        teamId: "mex",
        position: 2,
        mp: 3,
        pts: 0,
        gf: 0,
        ga: 5,
        gd: -5,
        qualified: false,
        team: { id: "mex", name: "Mexico", flag: "🇲🇽", code: "mx" },
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Argentina")).toBeInTheDocument();
    await expect(canvas.getByText("Mexico")).toBeInTheDocument();
    // Both rows should render (grayscale treatment is visual, tested in unit test)
  },
};
