import type { Meta, StoryObj } from "@storybook/react";
import { Filter } from "lucide-react";
import { expect, fn, userEvent, within } from "storybook/test";
import { Select } from "./select";

const meta: Meta<typeof Select> = {
  title: "Components/UI/Select",
  component: Select,
  args: {
    onChange: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof Select>;

export const Default: Story = {
  args: {
    defaultValue: "",
    children: (
      <>
        <option value="">All Teams</option>
        <option value="mex">Mexico</option>
        <option value="usa">United States</option>
        <option value="can">Canada</option>
      </>
    ),
  },
};

export const WithFilterIcon: Story = {
  args: {
    icon: <Filter className="h-3.5 w-3.5" />,
    defaultValue: "",
    children: (
      <>
        <option value="">All Phases</option>
        <option value="group">Group Stage</option>
        <option value="r16">Round of 16</option>
        <option value="qf">Quarter-final</option>
      </>
    ),
  },
};

export const WithFilterIconPlay: Story = {
  args: {
    icon: <Filter className="h-3.5 w-3.5" />,
    defaultValue: "",
    "aria-label": "Phase filter",
    children: (
      <>
        <option value="">All Phases</option>
        <option value="group">Group Stage</option>
        <option value="r16">Round of 16</option>
      </>
    ),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const select = canvas.getByRole("combobox", { name: /phase filter/i });

    await expect(select).toBeInTheDocument();

    await userEvent.selectOptions(select, "group");
    await expect(args.onChange).toHaveBeenCalled();
  },
};
