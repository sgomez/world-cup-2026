import { composeStories } from "@storybook/react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import * as stories from "./card.stories";

const {
  Default,
  Compact,
  Interactive,
  HeaderOnly,
  BodyOnly,
  CompactInteractive,
} = composeStories(stories);

describe("Card Composed Stories", () => {
  it("renders Default story with all parts", async () => {
    await Default.run();
  });

  it("renders Compact story with compact parts", async () => {
    await Compact.run();
  });

  it("renders Interactive story", async () => {
    await Interactive.run();
  });

  it("renders HeaderOnly story", async () => {
    await HeaderOnly.run();
  });

  it("renders BodyOnly story", async () => {
    await BodyOnly.run();
  });

  it("renders CompactInteractive story", async () => {
    await CompactInteractive.run();
  });

  it("renders children correctly in each part", () => {
    render(<Default />);
    expect(screen.getByText("Header content")).toBeInTheDocument();
    expect(screen.getByText("Body content")).toBeInTheDocument();
    expect(screen.getByText("Footer content")).toBeInTheDocument();
  });

  it("renders compact card children correctly", () => {
    render(<Compact />);
    expect(screen.getByText("Compact header")).toBeInTheDocument();
    expect(screen.getByText("Compact body")).toBeInTheDocument();
    expect(screen.getByText("Compact footer")).toBeInTheDocument();
  });

  it("renders interactive card children correctly", () => {
    render(<Interactive />);
    expect(
      screen.getByText("Interactive card with hover shadow"),
    ).toBeInTheDocument();
  });
});
