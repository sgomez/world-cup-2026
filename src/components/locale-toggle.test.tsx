import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleToggle } from "./locale-toggle";

const mockReplace = vi.fn();
const mockPathname = "/some/path";

vi.mock("next-intl", () => ({
  useLocale: vi.fn(() => "en"),
  useTranslations: vi.fn(
    () => (key: string) => ({ switchLanguage: "Switch language" })[key] ?? key,
  ),
}));

vi.mock("@/i18n/navigation", () => ({
  useRouter: vi.fn(() => ({ replace: mockReplace })),
  usePathname: vi.fn(() => mockPathname),
}));

import { useLocale } from "next-intl";

describe("LocaleToggle", () => {
  beforeEach(() => {
    mockReplace.mockReset();
  });

  it("renders current locale label when locale is en", () => {
    vi.mocked(useLocale).mockReturnValue("en");
    render(<LocaleToggle />);
    expect(screen.getByText("EN")).toBeInTheDocument();
  });

  it("renders current locale label when locale is es", () => {
    vi.mocked(useLocale).mockReturnValue("es");
    render(<LocaleToggle />);
    expect(screen.getByText("ES")).toBeInTheDocument();
  });

  it("renders aria-label from translations", () => {
    vi.mocked(useLocale).mockReturnValue("en");
    render(<LocaleToggle />);
    expect(
      screen.getByRole("button", { name: "Switch language" }),
    ).toBeInTheDocument();
  });

  it("clicking en locale calls router.replace with es locale", async () => {
    vi.mocked(useLocale).mockReturnValue("en");
    render(<LocaleToggle />);
    await userEvent.click(screen.getByRole("button"));
    expect(mockReplace).toHaveBeenCalledWith(mockPathname, { locale: "es" });
  });

  it("clicking es locale calls router.replace with en locale", async () => {
    vi.mocked(useLocale).mockReturnValue("es");
    render(<LocaleToggle />);
    await userEvent.click(screen.getByRole("button"));
    expect(mockReplace).toHaveBeenCalledWith(mockPathname, { locale: "en" });
  });

  it("unknown locale falls back to en display and toggles to es", async () => {
    vi.mocked(useLocale).mockReturnValue("pt");
    render(<LocaleToggle />);
    expect(screen.getByText("EN")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button"));
    expect(mockReplace).toHaveBeenCalledWith(mockPathname, { locale: "es" });
  });
});
