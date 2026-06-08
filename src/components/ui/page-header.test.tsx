import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageHeader } from "./page-header";

describe("PageHeader", () => {
  it("stacks the action below the title on mobile and aligns it inline on larger screens", () => {
    render(
      <PageHeader
        title="My title"
        action={<button type="button">Act</button>}
      />,
    );

    const root = screen.getByText("Act").closest("div")?.parentElement;
    expect(root).toHaveClass("flex-col");
    expect(root).toHaveClass("sm:flex-row");
  });

  it("keeps the title able to shrink so long titles can truncate", () => {
    render(<PageHeader title="My title" />);

    const titleWrapper = screen.getByRole("heading").parentElement;
    expect(titleWrapper).toHaveClass("min-w-0");
  });
});
