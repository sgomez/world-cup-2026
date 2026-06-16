import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { RankHistoryChartView } from "./rank-history-chart";

const mockBets = [
  {
    id: "bet-1",
    userId: "user-1",
    label: { obfuscated: false, value: "Viewer's Prediction" } as const,
  },
  {
    id: "bet-2",
    userId: "user-2",
    label: { obfuscated: false, value: "Top Player 1" } as const,
  },
  {
    id: "bet-3",
    userId: "user-3",
    label: {
      obfuscated: true,
      num: "3",
      head: "Jo",
      tail: "hn",
      middleLen: 4,
    } as const,
  },
];

const mockStepsStandard = [
  {
    matchNum: 0,
    isLive: false,
    ranks: {
      "bet-1": { rank: 1, points: 0 },
      "bet-2": { rank: 1, points: 0 },
      "bet-3": { rank: 1, points: 0 },
    },
  },
  {
    matchNum: 1,
    isLive: false,
    ranks: {
      "bet-1": { rank: 1, points: 3 },
      "bet-2": { rank: 2, points: 1 },
      "bet-3": { rank: 3, points: 0 },
    },
  },
  {
    matchNum: 2,
    isLive: false,
    ranks: {
      "bet-1": { rank: 2, points: 3 },
      "bet-2": { rank: 1, points: 4 },
      "bet-3": { rank: 3, points: 1 },
    },
  },
  {
    matchNum: 3,
    isLive: false,
    ranks: {
      "bet-1": { rank: 3, points: 4 },
      "bet-2": { rank: 1, points: 8 },
      "bet-3": { rank: 2, points: 5 },
    },
  },
];

const mockStepsLive = [
  ...mockStepsStandard,
  {
    matchNum: 4,
    isLive: true,
    ranks: {
      "bet-1": { rank: 2, points: 7 },
      "bet-2": { rank: 1, points: 10 },
      "bet-3": { rank: 3, points: 6 },
    },
  },
];

const meta: Meta<typeof RankHistoryChartView> = {
  title: "Components/RankHistoryChart",
  component: RankHistoryChartView,
  args: {
    bets: mockBets,
    steps: mockStepsStandard,
    currentUserId: "user-1",
  },
};

export default meta;
type Story = StoryObj<typeof RankHistoryChartView>;

export const StandardProgress: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const title = canvas.getByText("Rank History");
    await expect(title).toBeInTheDocument();
  },
};

export const LiveProgress: Story = {
  args: {
    steps: mockStepsLive,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const title = canvas.getByText("Rank History");
    await expect(title).toBeInTheDocument();
  },
};

export const EmptyState: Story = {
  args: {
    steps: [],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const emptyText = canvas.getByText("No rank history available yet.");
    await expect(emptyText).toBeInTheDocument();
  },
};
