import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { MatchCard } from "./match-card";

const meta: Meta<typeof MatchCard> = {
  title: "Components/MatchCard",
  component: MatchCard,
  args: {
    isKnockout: false,
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
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const liveLabel = canvas.getByText("LIVE");
    await expect(liveLabel).toBeInTheDocument();
    const score = canvas.getByText("1");
    await expect(score).toBeInTheDocument();
  },
};

export const Finished: Story = {
  args: {
    status: "FINISHED",
    score1: "2",
    score2: "1",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const finished = canvas.getByText("Finished");
    await expect(finished).toBeInTheDocument();
  },
};

export const FinishedKnockout: Story = {
  args: {
    isKnockout: true,
    status: "FINISHED",
    score1: "1",
    score2: "1",
    penalties1: 5,
    penalties2: 3,
    t1Eliminated: false,
    t2Eliminated: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const finished = canvas.getByText("Finished");
    await expect(finished).toBeInTheDocument();
    // Goal scores appear
    const ones = canvas.getAllByText("1");
    await expect(ones.length).toBeGreaterThan(0);
    // Penalty badge values appear
    const penaltyBadge5 = canvas.getByText("5");
    await expect(penaltyBadge5).toBeInTheDocument();
    const penaltyBadge3 = canvas.getByText("3");
    await expect(penaltyBadge3).toBeInTheDocument();
  },
};
