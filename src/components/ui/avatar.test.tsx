import { composeStories } from "@storybook/react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import * as stories from "./avatar.stories";

const { Default, WithImage, WithBadge, Group } = composeStories(stories);

describe("Avatar Composed Stories", () => {
  it("renders the Default story showing fallback text", () => {
    render(<Default />);
    const fallback = screen.getByText("JD");
    expect(fallback).toBeInTheDocument();
  });

  it("renders the WithImage story showing fallback when image is loading", () => {
    render(<WithImage />);
    const fallback = screen.getByText("JD");
    expect(fallback).toBeInTheDocument();
  });

  it("renders the WithBadge story containing a badge element", () => {
    const { container } = render(<WithBadge />);
    const badge = container.querySelector('[data-slot="avatar-badge"]');
    expect(badge).toBeInTheDocument();
  });

  it("renders the Group story with multiple avatars", () => {
    render(<Group />);
    const fallbacks = screen.getAllByText(/[A-C]/);
    expect(fallbacks).toHaveLength(3);
  });
});
