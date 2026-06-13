import { composeStories } from "@storybook/react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import * as stories from "./toast.stories";

const { Info, Success, ToastError, InteractivePlay } = composeStories(stories);

describe("Toast Composed Stories", () => {
  it("renders the Info story trigger button", () => {
    render(<Info />);
    const trigger = screen.getByRole("button", { name: /show toast/i });
    expect(trigger).toBeInTheDocument();
  });

  it("renders the Success story trigger button", () => {
    render(<Success />);
    const trigger = screen.getByRole("button", { name: /show toast/i });
    expect(trigger).toBeInTheDocument();
  });

  it("renders the ToastError story trigger button", () => {
    render(<ToastError />);
    const trigger = screen.getByRole("button", { name: /show toast/i });
    expect(trigger).toBeInTheDocument();
  });

  it("proves the toast behavior via play function", async () => {
    const { container } = render(<InteractivePlay />);
    await InteractivePlay.run({ canvasElement: container });
  });
});
