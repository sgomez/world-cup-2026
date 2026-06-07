import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { useParams, useSearchParams } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authClient } from "@/lib/auth-client";
import LoginPage from "./page";

vi.mock("next-intl", () => ({
  useTranslations: vi.fn(() => (key: string) => key),
}));

vi.mock("next/navigation", () => ({
  useParams: vi.fn(),
  useSearchParams: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: {
      social: vi.fn(),
    },
  },
}));

describe("LoginPage", () => {
  const mockUseParams = vi.mocked(useParams);
  const mockUseSearchParams = vi.mocked(useSearchParams);
  const mockSocialSignIn = vi.mocked(authClient.signIn.social);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders login button and handles click with default callback URL when no 'from' param is provided", async () => {
    mockUseParams.mockReturnValue({ locale: "en" });
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams() as unknown as ReadonlyURLSearchParams,
    );
    mockSocialSignIn.mockResolvedValue(undefined as never);

    render(<LoginPage />);

    const button = screen.getByRole("button", { name: /signInWithGoogle/i });
    expect(button).toBeInTheDocument();

    await userEvent.click(button);

    expect(mockSocialSignIn).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "/bets",
    });
  });

  it("uses Spanish prefix for default callback URL when locale is 'es' and no 'from' param is provided", async () => {
    mockUseParams.mockReturnValue({ locale: "es" });
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams() as unknown as ReadonlyURLSearchParams,
    );
    mockSocialSignIn.mockResolvedValue(undefined as never);

    render(<LoginPage />);

    const button = screen.getByRole("button", { name: /signInWithGoogle/i });
    await userEvent.click(button);

    expect(mockSocialSignIn).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "/es/bets",
    });
  });

  it("appends query param 'from' without locale prefix when locale is 'en'", async () => {
    mockUseParams.mockReturnValue({ locale: "en" });
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams(
        "from=/communities/join/token123",
      ) as unknown as ReadonlyURLSearchParams,
    );
    mockSocialSignIn.mockResolvedValue(undefined as never);

    render(<LoginPage />);

    const button = screen.getByRole("button", { name: /signInWithGoogle/i });
    await userEvent.click(button);

    expect(mockSocialSignIn).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "/communities/join/token123",
    });
  });

  it("prepends 'es' to 'from' param when locale is 'es'", async () => {
    mockUseParams.mockReturnValue({ locale: "es" });
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams(
        "from=/communities/join/token123",
      ) as unknown as ReadonlyURLSearchParams,
    );
    mockSocialSignIn.mockResolvedValue(undefined as never);

    render(<LoginPage />);

    const button = screen.getByRole("button", { name: /signInWithGoogle/i });
    await userEvent.click(button);

    expect(mockSocialSignIn).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "/es/communities/join/token123",
    });
  });

  it("does not duplicate 'es' prefix if 'from' param already starts with '/es/'", async () => {
    mockUseParams.mockReturnValue({ locale: "es" });
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams(
        "from=/es/communities/join/token123",
      ) as unknown as ReadonlyURLSearchParams,
    );
    mockSocialSignIn.mockResolvedValue(undefined as never);

    render(<LoginPage />);

    const button = screen.getByRole("button", { name: /signInWithGoogle/i });
    await userEvent.click(button);

    expect(mockSocialSignIn).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "/es/communities/join/token123",
    });
  });

  it("sanitises external 'from' parameter and falls back to default English path", async () => {
    mockUseParams.mockReturnValue({ locale: "en" });
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams(
        "from=https://external.com/malicious",
      ) as unknown as ReadonlyURLSearchParams,
    );
    mockSocialSignIn.mockResolvedValue(undefined as never);

    render(<LoginPage />);

    const button = screen.getByRole("button", { name: /signInWithGoogle/i });
    await userEvent.click(button);

    expect(mockSocialSignIn).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "/bets",
    });
  });

  it("sanitises external 'from' parameter and falls back to default Spanish path", async () => {
    mockUseParams.mockReturnValue({ locale: "es" });
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams(
        "from=//external.com/malicious",
      ) as unknown as ReadonlyURLSearchParams,
    );
    mockSocialSignIn.mockResolvedValue(undefined as never);

    render(<LoginPage />);

    const button = screen.getByRole("button", { name: /signInWithGoogle/i });
    await userEvent.click(button);

    expect(mockSocialSignIn).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "/es/bets",
    });
  });
});
