import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "./badge";

describe("Badge", () => {
  it("renders a badge with plain-text children wrapped in Badge.Label", () => {
    render(<Badge>5</Badge>);
    const badge = screen.getByText("5");
    expect(badge).toBeInTheDocument();
    // The text is inside Badge.Label
    expect(badge.tagName).toBe("SPAN");
  });

  it("renders nothing when children is null", () => {
    const { container } = render(<Badge>{null}</Badge>);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when children is undefined", () => {
    const { container } = render(<Badge>{undefined}</Badge>);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when no children are provided", () => {
    const { container } = render(<Badge />);
    expect(container.firstChild).toBeNull();
  });

  describe("placement", () => {
    it("applies top-right placement classes by default", () => {
      render(
        <Badge.Anchor>
          <div data-testid="anchor-child">anchor</div>
          <Badge>5</Badge>
        </Badge.Anchor>,
      );
      const badge = screen.getByText("5").closest('[class*="top-0"]');
      expect(badge).toBeInTheDocument();
      expect(badge?.className).toContain("right-0");
    });

    it("applies top-left placement classes", () => {
      render(
        <Badge.Anchor>
          <div>anchor</div>
          <Badge placement="top-left">5</Badge>
        </Badge.Anchor>,
      );
      const badge = screen.getByText("5").closest('[class*="top-0"]');
      expect(badge).toBeInTheDocument();
      expect(badge?.className).toContain("left-0");
    });

    it("applies bottom-right placement classes", () => {
      render(
        <Badge.Anchor>
          <div>anchor</div>
          <Badge placement="bottom-right">5</Badge>
        </Badge.Anchor>,
      );
      const badge = screen.getByText("5").closest('[class*="bottom-0"]');
      expect(badge).toBeInTheDocument();
      expect(badge?.className).toContain("right-0");
    });

    it("applies bottom-left placement classes", () => {
      render(
        <Badge.Anchor>
          <div>anchor</div>
          <Badge placement="bottom-left">5</Badge>
        </Badge.Anchor>,
      );
      const badge = screen.getByText("5").closest('[class*="bottom-0"]');
      expect(badge).toBeInTheDocument();
      expect(badge?.className).toContain("left-0");
    });
  });

  describe("size", () => {
    it("applies md size classes by default", () => {
      render(<Badge>5</Badge>);
      const badge = screen.getByText("5").closest('[class*="caption-sm"]');
      expect(badge).toBeInTheDocument();
      expect(badge?.className).toContain("py-0.5");
      expect(badge?.className).toContain("px-1.5");
      expect(badge?.className).toContain("rounded-full");
    });

    it("applies sm size classes", () => {
      render(<Badge size="sm">5</Badge>);
      const badge = screen.getByText("5").closest('[class*="text-\\[10px\\]"]');
      expect(badge).toBeInTheDocument();
      expect(badge?.className).toContain("py-px");
      expect(badge?.className).toContain("px-1");
      expect(badge?.className).toContain("rounded-full");
    });

    it("applies lg size classes", () => {
      render(<Badge size="lg">5</Badge>);
      const badge = screen.getByText("5").closest('[class*="caption-md"]');
      expect(badge).toBeInTheDocument();
      expect(badge?.className).toContain("py-0.5");
      expect(badge?.className).toContain("px-2");
      expect(badge?.className).toContain("rounded-full");
    });
  });

  describe("color", () => {
    it("applies default color classes by default", () => {
      render(<Badge>5</Badge>);
      const badge = screen.getByText("5").closest('[class*="bg-soft-cloud"]');
      expect(badge).toBeInTheDocument();
      expect(badge?.className).toContain("text-ink");
      expect(badge?.className).toContain("border-hairline");
    });

    it("applies success color classes", () => {
      render(<Badge color="success">5</Badge>);
      const badge = screen.getByText("5").closest('[class*="bg-success\\/10"]');
      expect(badge).toBeInTheDocument();
      expect(badge?.className).toContain("text-success");
    });
  });
});

describe("Badge.Anchor", () => {
  it("renders a relative-positioned wrapper containing children and badge", () => {
    render(
      <Badge.Anchor>
        <div data-testid="anchor-child">Score Box</div>
        <Badge>5</Badge>
      </Badge.Anchor>,
    );
    const anchorChild = screen.getByTestId("anchor-child");
    expect(anchorChild).toBeInTheDocument();
    expect(anchorChild.textContent).toBe("Score Box");

    // The badge text should also be present
    expect(screen.getByText("5")).toBeInTheDocument();

    // The wrapper should have relative positioning
    const wrapper = anchorChild.parentElement;
    expect(wrapper?.className).toContain("relative");
  });

  it("positions the badge absolutely relative to the anchor", () => {
    render(
      <Badge.Anchor>
        <div>anchor</div>
        <Badge placement="top-right">5</Badge>
      </Badge.Anchor>,
    );
    const badge = screen.getByText("5").closest('[class*="absolute"]');
    expect(badge).toBeInTheDocument();
  });
});
