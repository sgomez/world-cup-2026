import type { Meta, StoryObj } from "@storybook/react";
import type * as React from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { buttonVariants } from "./button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";

const meta: Meta<typeof DropdownMenu> = {
  title: "Components/UI/DropdownMenu",
  component: DropdownMenu,
  args: {
    onOpenChange: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof DropdownMenu>;

export const Default: Story = {
  render: (args) => (
    <DropdownMenu {...args}>
      <DropdownMenuTrigger className={buttonVariants({ variant: "default" })}>
        Open Dropdown
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>Profile</DropdownMenuItem>
        <DropdownMenuItem>Settings</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">Logout</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

export const CheckboxAndRadio: Story = {
  render: (args) => (
    <DropdownMenu {...args}>
      <DropdownMenuTrigger className={buttonVariants({ variant: "default" })}>
        Options
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuCheckboxItem checked>
          Show Status Bar
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem>Show Activity</DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value="light">
          <DropdownMenuRadioItem value="light">
            Light Mode
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">Dark Mode</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

type InteractivePlayStory = StoryObj<
  React.ComponentProps<typeof DropdownMenu> & { onItemClick?: () => void }
>;

export const InteractivePlay: InteractivePlayStory = {
  args: {
    onItemClick: fn(),
  },
  render: (args) => (
    <DropdownMenu>
      <DropdownMenuTrigger className={buttonVariants({ variant: "default" })}>
        Click Me
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={args.onItemClick}>
          Trigger Action
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: /click me/i });

    // Open the dropdown menu
    await userEvent.click(trigger);

    // Retrieve the item from the portal (inside document.body)
    const item = await screen.findByRole("menuitem", {
      name: /trigger action/i,
    });
    expect(item).toBeInTheDocument();

    // Click the item
    await userEvent.click(item);

    // Assert onClick callback was invoked
    expect(args.onItemClick).toHaveBeenCalled();

    // Wait for the exit animation/transition to complete and clean up
    await new Promise((resolve) => setTimeout(resolve, 150));
  },
};

import { screen } from "storybook/test";
