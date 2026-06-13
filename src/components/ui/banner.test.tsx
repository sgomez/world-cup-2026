import { composeStories } from "@storybook/react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import * as stories from "./banner.stories";

const { Info, Warning } = composeStories(stories);

describe("Banner Composed Stories", () => {
  it("renders the Info story with correct text", () => {
    render(<Info />);
    const text = screen.getByText("This is an informational banner.");
    expect(text).toBeInTheDocument();
  });

  it("renders the Warning story with correct text", () => {
    render(<Warning />);
    const text = screen.getByText("This is a warning banner.");
    expect(text).toBeInTheDocument();
  });
});
