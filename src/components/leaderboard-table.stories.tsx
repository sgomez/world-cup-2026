import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { LeaderboardTable } from "./leaderboard-table";

const meta: Meta<typeof LeaderboardTable> = {
  title: "Components/LeaderboardTable",
  component: LeaderboardTable,
  args: {
    entries: [
      {
        betId: "bet-1",
        userId: "user-1",
        userName: "Alice",
        betName: { obfuscated: false, value: "Alice's Predictions" },
        points: 42,
        createdAt: new Date("2026-06-08T12:00:00Z"),
        rank: 1,
        hasCup: false,
        selectionsHidden: false,
        bet: null,
      },
      {
        betId: "bet-2",
        userId: "user-2",
        userName: "Bob",
        betName: { obfuscated: false, value: "Bob's Sweepstakes" },
        points: 35,
        createdAt: new Date("2026-06-08T12:05:00Z"),
        rank: 2,
        hasCup: false,
        selectionsHidden: false,
        bet: null,
      },
    ],
    currentUserId: "user-1",
    tournamentEnded: false,
  },
};

export default meta;
type Story = StoryObj<typeof LeaderboardTable>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const aliceName = canvas.getByText("Alice");
    await expect(aliceName).toBeInTheDocument();

    const alicePoints = canvas.getByText("42");
    await expect(alicePoints).toBeInTheDocument();
  },
};

export const Empty: Story = {
  args: {
    entries: [],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const noBetsText = canvas.getByText(
      "No participants have closed bets yet in this community.",
    );
    await expect(noBetsText).toBeInTheDocument();
  },
};
