import { composeStories } from "@storybook/react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import * as stories from "./tabs.stories";

const { Default, LineVariant, Vertical, InteractivePlay } =
  composeStories(stories);

describe("Tabs Composed Stories", () => {
  it("renders the Default story", () => {
    render(<Default />);
    const tab = screen.getByRole("tab", { name: /account/i });
    expect(tab).toBeInTheDocument();
    expect(screen.getByText("Account Content Details")).toBeInTheDocument();
  });

  it("renders the LineVariant story", () => {
    render(<LineVariant />);
    const tab = screen.getByRole("tab", { name: /overview/i });
    expect(tab).toBeInTheDocument();
  });

  it("renders the Vertical story", () => {
    render(<Vertical />);
    const tab = screen.getByRole("tab", { name: /general/i });
    expect(tab).toBeInTheDocument();
  });

  it("proves the tab switching behavior via play function", async () => {
    const { container } = render(<InteractivePlay />);
    await InteractivePlay.run({ canvasElement: container });
  });
});
