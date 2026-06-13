import type { Meta, StoryObj } from "@storybook/react";
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarImage,
} from "./avatar";

const meta: Meta<typeof Avatar> = {
  title: "Components/UI/Avatar",
  component: Avatar,
  args: {
    size: "default",
  },
  argTypes: {
    size: {
      control: "select",
      options: ["default", "sm", "lg"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Avatar>;

export const Default: Story = {
  render: (args) => (
    <Avatar {...args}>
      <AvatarFallback>JD</AvatarFallback>
    </Avatar>
  ),
};

export const WithImage: Story = {
  render: (args) => (
    <Avatar {...args}>
      <AvatarImage
        src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80"
        alt="Jane Doe"
      />
      <AvatarFallback>JD</AvatarFallback>
    </Avatar>
  ),
};

export const WithBadge: Story = {
  render: (args) => (
    <Avatar {...args}>
      <AvatarImage
        src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80"
        alt="Jane Doe"
      />
      <AvatarFallback>JD</AvatarFallback>
      <AvatarBadge className="bg-success" />
    </Avatar>
  ),
};

export const Group: Story = {
  render: (args) => (
    <AvatarGroup>
      <Avatar {...args}>
        <AvatarFallback>A</AvatarFallback>
      </Avatar>
      <Avatar {...args}>
        <AvatarFallback>B</AvatarFallback>
      </Avatar>
      <Avatar {...args}>
        <AvatarFallback>C</AvatarFallback>
      </Avatar>
    </AvatarGroup>
  ),
};
