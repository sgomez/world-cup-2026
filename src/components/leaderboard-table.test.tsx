import { composeStories } from "@storybook/react";
import { describe, it, vi } from "vitest";
import * as stories from "./leaderboard-table.stories";

// LeaderboardTable uses Link from @/i18n/navigation which depends on next/navigation.
// In the happy-dom test environment we swap it for a plain anchor element.
vi.mock("@/i18n/navigation", () => ({
  Link: ({
    children,
    href,
    className,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
    [key: string]: unknown;
  }) => (
    <a href={href} className={className} {...props}>
      {children}
    </a>
  ),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  })),
  usePathname: () => "/leaderboard",
}));

const { Default, Empty } = composeStories(stories);

describe("LeaderboardTable Composed Stories", () => {
  it("runs Default story play function", async () => {
    await Default.run();
  });

  it("runs Empty story play function", async () => {
    await Empty.run();
  });
});
