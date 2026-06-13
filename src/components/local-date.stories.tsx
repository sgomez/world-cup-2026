import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { vi } from "vitest";
import { LocalDate } from "./local-date";

const FROZEN_DATE = new Date("2026-06-11T19:00:00Z");

const meta: Meta<typeof LocalDate> = {
  title: "Components/LocalDate",
  component: LocalDate,
  args: {
    date: FROZEN_DATE,
  },
};

export default meta;
type Story = StoryObj<typeof LocalDate>;

export const Default: Story = {
  beforeEach: () => {
    vi.setSystemTime(FROZEN_DATE);
    return () => {
      vi.useRealTimers();
    };
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const utcText = canvas.getByText(/2026-06-11 19:00 UTC/);
    await expect(utcText).toBeInTheDocument();
  },
};
