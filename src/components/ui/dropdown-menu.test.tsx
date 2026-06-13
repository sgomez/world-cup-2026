import { composeStories } from "@storybook/react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import * as stories from "./dropdown-menu.stories";

const { Default, CheckboxAndRadio, InteractivePlay } = composeStories(stories);

describe("DropdownMenu Composed Stories", () => {
  it("renders the Default trigger button", () => {
    render(<Default />);
    const trigger = screen.getByRole("button", { name: /open dropdown/i });
    expect(trigger).toBeInTheDocument();
  });

  it("renders the CheckboxAndRadio trigger button", () => {
    render(<CheckboxAndRadio />);
    const trigger = screen.getByRole("button", { name: /options/i });
    expect(trigger).toBeInTheDocument();
  });

  it("proves the dropdown interactive behavior via play function", async () => {
    const { container } = render(<InteractivePlay />);
    await InteractivePlay.run({ canvasElement: container });
  });
});
