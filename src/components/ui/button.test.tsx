import { composeStories } from "@storybook/react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import * as stories from "./button.stories";

const { Default, Disabled, Loading, LoadingPlay } = composeStories(stories);

describe("Button Composed Stories", () => {
  it("renders the Default story", () => {
    render(<Default />);
    const button = screen.getByRole("button", { name: /button/i });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  });

  it("renders the Disabled story as disabled", () => {
    render(<Disabled />);
    const button = screen.getByRole("button", { name: /disabled button/i });
    expect(button).toBeDisabled();
  });

  it("renders the Loading story with busy and disabled attributes", () => {
    render(<Loading />);
    const button = screen.getByRole("button", { name: /loading/i });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toBeDisabled();
  });

  it("proves the loading contract via play function", async () => {
    await LoadingPlay.run();
  });
});
