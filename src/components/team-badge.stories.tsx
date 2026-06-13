import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { TeamBadge } from "./team-badge";

const meta: Meta<typeof TeamBadge> = {
  title: "Components/TeamBadge",
  component: TeamBadge,
  args: {
    team: {
      id: "arg",
      name: "Argentina",
      flag: "🇦🇷",
      code: "ar",
    },
  },
};

export default meta;
type Story = StoryObj<typeof TeamBadge>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const text = canvas.getByText("Argentina");
    await expect(text).toBeInTheDocument();
  },
};

export const Eliminated: Story = {
  args: {
    eliminated: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const text = canvas.getByText("Argentina");
    await expect(text).toBeInTheDocument();
  },
};
