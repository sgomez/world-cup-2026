import { composeStories } from "@storybook/react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Team } from "@/modules/teams";
import { TeamBadge } from "./team-badge";
import * as stories from "./team-badge.stories";

const { Default, Eliminated } = composeStories(stories);

const mockTeam: Team = {
  id: "arg",
  name: "Argentina",
  flag: "🇦🇷",
  code: "ar",
};

describe("TeamBadge", () => {
  it("renders the team name", () => {
    render(<TeamBadge team={mockTeam} />);
    expect(screen.getByText("Argentina")).toBeInTheDocument();
  });

  it("applies grayscale filter when eliminated", () => {
    const { container } = render(<TeamBadge team={mockTeam} eliminated />);
    const badgeDiv = container.firstChild as HTMLElement;
    expect(badgeDiv.className).toContain("grayscale");
  });

  it("does not render a border when border prop is false", () => {
    const { container } = render(<TeamBadge team={mockTeam} border={false} />);
    const badgeDiv = container.firstChild as HTMLElement;
    expect(badgeDiv.className).not.toContain("border");
  });

  it("renders background image with correct URL containing team.code", () => {
    const { container } = render(<TeamBadge team={mockTeam} />);
    const flagBgDiv = container.querySelector(
      "div[style*='background-image']",
    ) as HTMLElement;
    expect(flagBgDiv).toBeInTheDocument();
    const style = flagBgDiv.getAttribute("style") || "";
    expect(style).toContain("flagcdn.com/w320/ar.png");
  });
});

describe("TeamBadge Composed Stories", () => {
  it("runs Default story play function", async () => {
    await Default.run();
  });

  it("runs Eliminated story play function", async () => {
    await Eliminated.run();
  });
});
