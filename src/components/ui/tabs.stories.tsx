import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

const meta: Meta<typeof Tabs> = {
  title: "Components/UI/Tabs",
  component: Tabs,
  args: {
    defaultValue: "tab1",
    orientation: "horizontal",
  },
  argTypes: {
    orientation: {
      control: "select",
      options: ["horizontal", "vertical"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Tabs>;

export const Default: Story = {
  render: (args) => (
    <Tabs {...args}>
      <TabsList>
        <TabsTrigger value="tab1">Account</TabsTrigger>
        <TabsTrigger value="tab2">Password</TabsTrigger>
        <TabsTrigger value="tab3">Settings</TabsTrigger>
      </TabsList>
      <TabsContent value="tab1" className="p-4">
        Account Content Details
      </TabsContent>
      <TabsContent value="tab2" className="p-4">
        Password Security Settings
      </TabsContent>
      <TabsContent value="tab3" className="p-4">
        Global Account Preferences
      </TabsContent>
    </Tabs>
  ),
};

export const LineVariant: Story = {
  render: (args) => (
    <Tabs {...args}>
      <TabsList variant="line">
        <TabsTrigger value="tab1">Overview</TabsTrigger>
        <TabsTrigger value="tab2">Brackets</TabsTrigger>
        <TabsTrigger value="tab3">Leaderboard</TabsTrigger>
      </TabsList>
      <TabsContent value="tab1" className="p-4">
        Tournament Overview Content
      </TabsContent>
      <TabsContent value="tab2" className="p-4">
        User Brackets List
      </TabsContent>
      <TabsContent value="tab3" className="p-4">
        Community Leaderboard Table
      </TabsContent>
    </Tabs>
  ),
};

export const Vertical: Story = {
  args: {
    orientation: "vertical",
  },
  render: (args) => (
    <Tabs {...args}>
      <TabsList>
        <TabsTrigger value="tab1">General</TabsTrigger>
        <TabsTrigger value="tab2">Notifications</TabsTrigger>
        <TabsTrigger value="tab3">Privacy</TabsTrigger>
      </TabsList>
      <TabsContent value="tab1" className="p-4">
        General Settings
      </TabsContent>
      <TabsContent value="tab2" className="p-4">
        Notifications Preferences
      </TabsContent>
      <TabsContent value="tab3" className="p-4">
        Privacy Options
      </TabsContent>
    </Tabs>
  ),
};

export const InteractivePlay: Story = {
  render: (args) => (
    <Tabs {...args}>
      <TabsList>
        <TabsTrigger value="tab1">Tab One</TabsTrigger>
        <TabsTrigger value="tab2">Tab Two</TabsTrigger>
      </TabsList>
      <TabsContent value="tab1" className="p-4">
        Content One
      </TabsContent>
      <TabsContent value="tab2" className="p-4">
        Content Two
      </TabsContent>
    </Tabs>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const tabOneTrigger = canvas.getByRole("tab", { name: /tab one/i });
    const tabTwoTrigger = canvas.getByRole("tab", { name: /tab two/i });

    // Assert initial active state attributes
    await expect(tabOneTrigger).toHaveAttribute("aria-selected", "true");
    await expect(tabTwoTrigger).toHaveAttribute("aria-selected", "false");

    // Click Tab Two
    await userEvent.click(tabTwoTrigger);

    // Assert updated active state attributes
    await expect(tabOneTrigger).toHaveAttribute("aria-selected", "false");
    await expect(tabTwoTrigger).toHaveAttribute("aria-selected", "true");
  },
};
