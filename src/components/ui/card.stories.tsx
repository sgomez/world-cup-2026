import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { Card, CardBody, CardFooter, CardHeader } from "./card";

const meta: Meta<typeof Card> = {
  title: "Components/UI/Card",
  component: Card,
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card>
      <CardHeader>Header content</CardHeader>
      <CardBody>Body content</CardBody>
      <CardFooter>Footer content</CardFooter>
    </Card>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Header content")).toBeInTheDocument();
    await expect(canvas.getByText("Body content")).toBeInTheDocument();
    await expect(canvas.getByText("Footer content")).toBeInTheDocument();
  },
};

export const Compact: Story = {
  render: () => (
    <Card size="compact">
      <CardHeader size="compact">Compact header</CardHeader>
      <CardBody size="compact">Compact body</CardBody>
      <CardFooter size="compact">Compact footer</CardFooter>
    </Card>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Compact header")).toBeInTheDocument();
    await expect(canvas.getByText("Compact body")).toBeInTheDocument();
    await expect(canvas.getByText("Compact footer")).toBeInTheDocument();
  },
};

export const Interactive: Story = {
  render: () => (
    <Card variant="interactive">
      <CardBody>Interactive card with hover shadow</CardBody>
    </Card>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("Interactive card with hover shadow"),
    ).toBeInTheDocument();
  },
};

export const HeaderOnly: Story = {
  render: () => (
    <Card>
      <CardHeader>Just a header</CardHeader>
    </Card>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Just a header")).toBeInTheDocument();
  },
};

export const BodyOnly: Story = {
  render: () => (
    <Card>
      <CardBody>Just body content</CardBody>
    </Card>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Just body content")).toBeInTheDocument();
  },
};

export const CompactInteractive: Story = {
  render: () => (
    <Card size="compact" variant="interactive">
      <CardHeader size="compact">Compact + interactive</CardHeader>
      <CardBody size="compact">Compact interactive body</CardBody>
    </Card>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Compact + interactive")).toBeInTheDocument();
    await expect(
      canvas.getByText("Compact interactive body"),
    ).toBeInTheDocument();
  },
};
