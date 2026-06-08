import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LocalDate } from "./local-date";

vi.mock("next-intl", () => ({
  useLocale: vi.fn(() => "en"),
}));

import { useLocale } from "next-intl";

describe("LocalDate Component", () => {
  it("renders UTC fallback initially, then formats local timezone on mount", () => {
    const testDate = new Date("2026-06-11T19:00:00Z");

    const { container } = render(<LocalDate date={testDate} />);

    // Initially/after mount, it should show the UTC fallback and/or formatted local time containing the UTC string
    const utcText = "2026-06-11 19:00 UTC";
    expect(screen.getByText(utcText, { exact: false })).toBeInTheDocument();

    // After mount/effects, it should contain the UTC string in parenthesized format
    expect(container.textContent).toContain(`(${utcText})`);
  });

  it("respects the active locale (e.g. es uses 24h format)", () => {
    vi.mocked(useLocale).mockReturnValue("es");
    const testDate = new Date("2026-06-11T19:00:00Z");

    const { container } = render(<LocalDate date={testDate} />);
    // Spanish formatting uses 24-hour format and does not render AM/PM.
    expect(container.textContent).not.toContain("PM");
    expect(container.textContent).not.toContain("AM");
  });
});
