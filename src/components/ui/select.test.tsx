import { composeStories } from "@storybook/react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import * as stories from "./select.stories";

const { Default, WithFilterIcon, WithFilterIconPlay } = composeStories(stories);

describe("Select Composed Stories", () => {
  it("renders the Default story with options", () => {
    render(<Default />);
    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "All Teams" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Mexico" })).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "United States" }),
    ).toBeInTheDocument();
  });

  it("renders the WithFilterIcon story with a native select", () => {
    render(<WithFilterIcon />);
    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "All Phases" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Group Stage" }),
    ).toBeInTheDocument();
  });

  it("reflects value change via onChange", async () => {
    const user = userEvent.setup();
    render(<Default />);
    const select = screen.getByRole("combobox");

    await user.selectOptions(select, "mex");
    expect((select as HTMLSelectElement).value).toBe("mex");
  });

  it("runs the play function for WithFilterIconPlay", async () => {
    await WithFilterIconPlay.run();
  });
});
