import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Team } from "@/lib/teams";
import { MatchTeamRow } from "./knockout-stage";

const mockTeam: Team = {
  id: "arg",
  name: "Argentina",
  flag: "🇦🇷",
  code: "ar",
};

describe("MatchTeamRow", () => {
  it("fires onSelect when clicked and canSelect is true", async () => {
    const onSelect = vi.fn();
    render(
      <MatchTeamRow
        team={mockTeam}
        isWinner={false}
        isLoser={false}
        canSelect={true}
        onSelect={onSelect}
      />,
    );

    const button = screen.getByRole("button");
    await userEvent.click(button);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("does not fire onSelect and is disabled when canSelect is false", async () => {
    const onSelect = vi.fn();
    render(
      <MatchTeamRow
        team={mockTeam}
        isWinner={false}
        isLoser={false}
        canSelect={false}
        onSelect={onSelect}
      />,
    );

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();

    // Attempting a click shouldn't trigger the handler
    await userEvent.click(button);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
