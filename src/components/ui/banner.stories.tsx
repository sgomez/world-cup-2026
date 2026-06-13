import type { Meta, StoryObj } from "@storybook/react";
import { Banner } from "./banner";

const meta: Meta<typeof Banner> = {
  title: "Components/UI/Banner",
  component: Banner,
  args: {
    variant: "info",
    children: "This is a banner message.",
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["info", "warning"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Banner>;

export const Info: Story = {
  args: {
    variant: "info",
    children: "This is an informational banner.",
  },
};

export const Warning: Story = {
  args: {
    variant: "warning",
    children: "This is a warning banner.",
  },
};
