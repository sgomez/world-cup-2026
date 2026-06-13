import { DndContext } from "@dnd-kit/core";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { TeamRow } from "./team-row";

const meta: Meta<typeof TeamRow> = {
  title: "Components/TeamRow",
  component: TeamRow,
  decorators: [
    (Story) => (
      <DndContext>
        <Story />
      </DndContext>
    ),
  ],
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
type Story = StoryObj<typeof TeamRow>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const text = canvas.getByText("Argentina");
    await expect(text).toBeInTheDocument();
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const text = canvas.getByText("Argentina");
    await expect(text).toBeInTheDocument();
  },
};
