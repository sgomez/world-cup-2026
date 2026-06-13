import type { Meta, StoryObj } from "@storybook/react";
import { Info } from "lucide-react";
import { Button } from "./button";
import { PageHeader } from "./page-header";

const meta: Meta<typeof PageHeader> = {
  title: "Components/UI/PageHeader",
  component: PageHeader,
  args: {
    title: "Page Title",
    description:
      "This is a detailed page description explaining what the page does.",
  },
};

export default meta;
type Story = StoryObj<typeof PageHeader>;

export const Default: Story = {
  args: {
    title: "Default Page Header",
  },
};

export const WithDescriptionAndAction: Story = {
  args: {
    title: "Dashboard Overview",
    description: "Manage your team brackets and view statistics here.",
    action: <Button variant="default">Create Community</Button>,
  },
};

export const WithIcon: Story = {
  args: {
    title: "Tournament Settings",
    description: "Configure tournament rules and matches.",
    icon: <Info className="size-6" />,
    action: <Button variant="outline">Learn More</Button>,
  },
};
