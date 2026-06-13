import { composeStories } from "@storybook/react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import * as stories from "./page-header.stories";

const { Default, WithDescriptionAndAction, WithIcon } = composeStories(stories);

describe("PageHeader Composed Stories", () => {
  it("renders the Default page header", () => {
    render(<Default />);
    const heading = screen.getByRole("heading", {
      name: /default page header/i,
    });
    expect(heading).toBeInTheDocument();
  });

  it("renders with description and action", () => {
    render(<WithDescriptionAndAction />);
    expect(
      screen.getByText("Manage your team brackets and view statistics here."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create community/i }),
    ).toBeInTheDocument();

    const root = screen
      .getByRole("button", { name: /create community/i })
      .closest("div")?.parentElement;
    expect(root).toHaveClass("flex-col");
    expect(root).toHaveClass("sm:flex-row");
  });

  it("renders with an icon", () => {
    render(<WithIcon />);
    const heading = screen.getByRole("heading", {
      name: /tournament settings/i,
    });
    expect(heading).toBeInTheDocument();
    const titleWrapper = heading.parentElement;
    expect(titleWrapper).toHaveClass("min-w-0");
  });
});
