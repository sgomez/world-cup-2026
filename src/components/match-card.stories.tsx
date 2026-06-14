import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { MatchCard } from "./match-card";

const meta: Meta<typeof MatchCard> = {
  title: "Components/MatchCard",
  component: MatchCard,
  args: {
    round: "Group Stage",
    date: "2026-06-11",
    time: "19:00 UTC-5",
    team1: "Argentina",
    team2: "Canada",
    group: "A",
    ground: "MetLife Stadium, New Jersey",
    locale: "en",
    status: "UPCOMING",
  },
};

export default meta;
type Story = StoryObj<typeof MatchCard>;

export const Upcoming: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const upcoming = canvas.getByText("Upcoming");
    await expect(upcoming).toBeInTheDocument();
  },
};

export const Live: Story = {
  args: {
    status: "LIVE",
    score1: "1",
    score2: "0",
    livePhase: "first_half",
    liveMinute: 23,
    liveInStoppage: false,
    liveUpdatedAt: new Date(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const liveLabel = canvas.getByText("LIVE");
    await expect(liveLabel).toBeInTheDocument();
    const score = canvas.getByText("1");
    await expect(score).toBeInTheDocument();
  },
};

export const LiveSecondHalf: Story = {
  args: {
    status: "LIVE",
    score1: "1",
    score2: "1",
    livePhase: "second_half",
    liveMinute: 45,
    liveInStoppage: true,
    liveUpdatedAt: new Date(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const liveLabel = canvas.getByText("LIVE", { exact: false });
    await expect(liveLabel).toBeInTheDocument();
  },
};

export const Finished: Story = {
  args: {
    status: "FINISHED",
    score1: "2",
    score2: "1",
    round: "Group Stage",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const finished = canvas.getByText("Finished");
    await expect(finished).toBeInTheDocument();
  },
};
