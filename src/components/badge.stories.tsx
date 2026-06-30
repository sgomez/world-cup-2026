import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { Badge } from "./badge";

const meta: Meta<typeof Badge> = {
  title: "Components/Badge",
  component: Badge,
};

export default meta;
type Story = StoryObj<typeof Badge>;

const ScoreBox = ({ label }: { label: string }) => (
  <div className="bg-soft-cloud rounded-md px-4 py-2 text-ink font-semibold text-center min-w-16">
    {label}
  </div>
);

export const Default: Story = {
  render: () => (
    <Badge.Anchor>
      <ScoreBox label="2 - 2" />
      <Badge placement="top-right" size="sm">
        5
      </Badge>
    </Badge.Anchor>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("2 - 2")).toBeInTheDocument();
    await expect(canvas.getByText("5")).toBeInTheDocument();
  },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-start gap-16">
      <Badge.Anchor>
        <ScoreBox label="2 - 2" />
        <Badge placement="top-right" size="sm">
          1
        </Badge>
      </Badge.Anchor>
      <Badge.Anchor>
        <ScoreBox label="2 - 2" />
        <Badge placement="top-right" size="md">
          2
        </Badge>
      </Badge.Anchor>
      <Badge.Anchor>
        <ScoreBox label="2 - 2" />
        <Badge placement="top-right" size="lg">
          3
        </Badge>
      </Badge.Anchor>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("1")).toBeInTheDocument();
    await expect(canvas.getByText("2")).toBeInTheDocument();
    await expect(canvas.getByText("3")).toBeInTheDocument();
  },
};

export const Colors: Story = {
  render: () => (
    <div className="flex items-start gap-16">
      <Badge.Anchor>
        <ScoreBox label="2 - 2" />
        <Badge placement="top-right" size="sm">
          1
        </Badge>
      </Badge.Anchor>
      <Badge.Anchor>
        <ScoreBox label="2 - 2" />
        <Badge placement="top-right" size="sm" color="success">
          2
        </Badge>
      </Badge.Anchor>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("1")).toBeInTheDocument();
    await expect(canvas.getByText("2")).toBeInTheDocument();
  },
};

export const Placements: Story = {
  render: () => (
    <div className="flex items-start gap-16 py-8">
      <Badge.Anchor>
        <ScoreBox label="2 - 2" />
        <Badge placement="top-right" size="sm">
          1
        </Badge>
      </Badge.Anchor>
      <Badge.Anchor>
        <ScoreBox label="2 - 2" />
        <Badge placement="top-left" size="sm">
          2
        </Badge>
      </Badge.Anchor>
      <Badge.Anchor>
        <ScoreBox label="2 - 2" />
        <Badge placement="bottom-right" size="sm">
          3
        </Badge>
      </Badge.Anchor>
      <Badge.Anchor>
        <ScoreBox label="2 - 2" />
        <Badge placement="bottom-left" size="sm">
          4
        </Badge>
      </Badge.Anchor>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("1")).toBeInTheDocument();
    await expect(canvas.getByText("2")).toBeInTheDocument();
    await expect(canvas.getByText("3")).toBeInTheDocument();
    await expect(canvas.getByText("4")).toBeInTheDocument();
  },
};
