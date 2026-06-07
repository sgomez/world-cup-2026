import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Team } from "@/lib/teams";
import { TeamBadge } from "./team-badge";

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
