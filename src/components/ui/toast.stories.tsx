import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { Button } from "./button";
import { ToastProvider, type ToastType, useToast } from "./toast";

function ToastTrigger({
  message,
  type,
  duration,
}: {
  message: string;
  type?: ToastType;
  duration?: number;
}) {
  const { toast } = useToast();
  return (
    <Button onClick={() => toast(message, type, duration)}>Show Toast</Button>
  );
}

const meta: Meta<typeof ToastTrigger> = {
  title: "Components/UI/Toast",
  component: ToastTrigger,
  decorators: [
    (Story) => (
      <ToastProvider>
        <Story />
      </ToastProvider>
    ),
  ],
  args: {
    message: "This is a toast notification!",
    type: "info",
  },
  argTypes: {
    type: {
      control: "select",
      options: ["info", "success", "error"],
    },
    duration: {
      control: "number",
    },
  },
};

export default meta;
type Story = StoryObj<typeof ToastTrigger>;

export const Info: Story = {
  args: {
    message: "Info: Check this out.",
    type: "info",
  },
};

export const Success: Story = {
  args: {
    message: "Success: Action completed!",
    type: "success",
  },
};

export const ToastError: Story = {
  args: {
    message: "Error: Something went wrong.",
    type: "error",
  },
};

export const InteractivePlay: Story = {
  args: {
    message: "Interactive Toast",
    type: "success",
    // Set a large duration so it doesn't auto-dismiss during test checks
    duration: 10000,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: /show toast/i });

    // Toast should not be in the DOM initially
    const alertsBefore = document.body.querySelectorAll('[role="alert"]');
    expect(alertsBefore.length).toBe(0);

    // Trigger toast
    await userEvent.click(trigger);

    // Toast should appear in the document
    const alert = await screen.findByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(within(alert).getByText("Interactive Toast")).toBeInTheDocument();

    // Click close button on the toast
    const closeBtn = within(alert).getByRole("button");
    await userEvent.click(closeBtn);

    // The toast unmounts (we wait a short time for state transition)
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(alert).not.toBeInTheDocument();
  },
};

import { screen } from "storybook/test";
