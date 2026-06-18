import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { ArcadeSection } from "./arcade-section";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRefresh = vi.fn();

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

vi.mock("next-intl", () => ({
  useTranslations: vi.fn((_namespace: string) => {
    return (key: string) => {
      return (
        (
          {
            playButton: "Play Penguin Run",
            starting: "Starting…",
            startError: "Could not start a run. Please try again.",
            alreadyPlayedToday: "Already played today",
            resetsAt: "Resets at 00:00 UTC",
            invitationModalTitle: "Play Penguin Run!",
            invitationModalDescription: "Challenge yourself today.",
            playNow: "Play Now",
            maybeLater: "Maybe Later",
          } as Record<string, string>
        )[key] ?? key
      );
    };
  }),
}));

// Mock PenguinRunGame so the section tests don't need a canvas environment.
let capturedOnFinished: (() => void) | undefined;

vi.mock("./penguin-run-game", () => ({
  PenguinRunGame: ({
    runId,
    onFinished,
  }: {
    runId: string;
    onFinished: () => void;
    penguinImage: HTMLImageElement;
    obstacleImage: HTMLImageElement;
  }) => {
    capturedOnFinished = onFinished;
    return (
      <div data-testid="penguin-run-game" data-run-id={runId}>
        PenguinRunGame mock
      </div>
    );
  },
}));

// ---------------------------------------------------------------------------
// Image preload mock
// ---------------------------------------------------------------------------

type MockImageEntry = {
  _src: string;
  onload: (() => void) | null;
  onerror: (() => void) | null;
};

/** Tracks all Image instances created during the test. */
const createdImages: MockImageEntry[] = [];

/** When true (default), images resolve immediately on src set. */
let autoResolveImages = true;

const OriginalImage = globalThis.Image;

beforeAll(() => {
  // Replace the global Image constructor with a spy that captures instances.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).Image = class MockImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    _src = "";

    get src() {
      return this._src;
    }

    set src(value: string) {
      this._src = value;
      if (autoResolveImages && this.onload) {
        // Implementation sets onload before src, so onload is available here.
        this.onload();
      }
    }

    constructor() {
      createdImages.push(this as unknown as MockImageEntry);
    }
  };
});

afterAll(() => {
  globalThis.Image = OriginalImage;
});

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
  mockRefresh.mockReset();
  capturedOnFinished = undefined;
  createdImages.length = 0;
  autoResolveImages = true;
});

/**
 * Close the auto-opened invitation modal so the page Play button is exposed to
 * the accessibility tree (base-ui marks background content inert while open).
 */
async function dismissModal() {
  await userEvent.click(screen.getByRole("button", { name: "Maybe Later" }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ArcadeSection", () => {
  it("renders a disabled Play button and does not call the API when disabled", async () => {
    render(<ArcadeSection hasPlayedToday={false} enabled={false} />);

    const btn = screen.getByRole("button", { name: "Play Penguin Run" });
    expect(btn).toBeDisabled();
    await userEvent.click(btn);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("starts a run and mounts the game when the page Play button is clicked", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 201,
      json: async () => ({ id: "run-page", playDay: "2026-06-18" }),
    });

    render(<ArcadeSection hasPlayedToday={false} enabled={true} />);

    await dismissModal();
    await userEvent.click(
      screen.getByRole("button", { name: "Play Penguin Run" }),
    );

    expect(mockFetch).toHaveBeenCalledWith("/api/arcade/start", {
      method: "POST",
    });
    const game = screen.getByTestId("penguin-run-game");
    expect(game).toHaveAttribute("data-run-id", "run-page");
  });

  // Regression for #366 — pressing Play in the invitation modal previously
  // started a run server-side but never mounted the game.
  it("starts a run and mounts the game when the modal Play Now is clicked", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 201,
      json: async () => ({ id: "run-modal", playDay: "2026-06-18" }),
    });

    render(<ArcadeSection hasPlayedToday={false} enabled={true} />);

    // Modal auto-opens; click its Play Now.
    await userEvent.click(screen.getByRole("button", { name: "Play Now" }));

    expect(mockFetch).toHaveBeenCalledWith("/api/arcade/start", {
      method: "POST",
    });
    const game = screen.getByTestId("penguin-run-game");
    expect(game).toHaveAttribute("data-run-id", "run-modal");
  });

  it("transitions to 'Already played today' when the game fires onFinished", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 201,
      json: async () => ({ id: "run-fin", playDay: "2026-06-18" }),
    });

    render(<ArcadeSection hasPlayedToday={false} enabled={true} />);

    await dismissModal();
    await userEvent.click(
      screen.getByRole("button", { name: "Play Penguin Run" }),
    );
    expect(screen.getByTestId("penguin-run-game")).toBeInTheDocument();

    act(() => {
      capturedOnFinished?.();
    });

    expect(screen.queryByTestId("penguin-run-game")).not.toBeInTheDocument();
    expect(screen.getByText("Already played today")).toBeInTheDocument();
  });

  // Regression: the ranking table is server-rendered, so finishing a run must
  // refresh server data or the new score only appears after a manual reload.
  it("refreshes server data when the game fires onFinished", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 201,
      json: async () => ({ id: "run-refresh", playDay: "2026-06-18" }),
    });

    render(<ArcadeSection hasPlayedToday={false} enabled={true} />);

    await dismissModal();
    await userEvent.click(
      screen.getByRole("button", { name: "Play Penguin Run" }),
    );

    act(() => {
      capturedOnFinished?.();
    });

    expect(mockRefresh).toHaveBeenCalled();
  });

  it("shows 'Already played today' when start returns 409", async () => {
    mockFetch.mockResolvedValueOnce({ status: 409 });

    render(<ArcadeSection hasPlayedToday={false} enabled={true} />);

    await dismissModal();
    await userEvent.click(
      screen.getByRole("button", { name: "Play Penguin Run" }),
    );

    expect(screen.getByText("Already played today")).toBeInTheDocument();
    expect(screen.queryByTestId("penguin-run-game")).not.toBeInTheDocument();
  });

  it("shows an error when start fails", async () => {
    mockFetch.mockResolvedValueOnce({ status: 500 });

    render(<ArcadeSection hasPlayedToday={false} enabled={true} />);

    await dismissModal();
    await userEvent.click(
      screen.getByRole("button", { name: "Play Penguin Run" }),
    );

    expect(
      screen.getByText("Could not start a run. Please try again."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("penguin-run-game")).not.toBeInTheDocument();
  });

  it("starts in the already_played state when the user has already played", () => {
    render(<ArcadeSection hasPlayedToday={true} enabled={true} />);

    expect(screen.getByText("Already played today")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Sprite preloading
  // -------------------------------------------------------------------------

  it("starts loading both sprites on mount", () => {
    autoResolveImages = false;
    render(<ArcadeSection hasPlayedToday={false} enabled={true} />);

    const srcs = createdImages.map((img) => img._src);
    expect(srcs.some((s) => s.includes("penguin-walk"))).toBe(true);
    expect(srcs.some((s) => s.includes("dummy"))).toBe(true);
  });

  it("disables the Play button while sprites are still loading", async () => {
    autoResolveImages = false;
    render(<ArcadeSection hasPlayedToday={false} enabled={true} />);

    // Modal opens (enabled=true regardless of sprites); dismiss it so the
    // ArcadeStart button is not hidden behind the inert dialog backdrop.
    await dismissModal();

    // Images not resolved yet — Play button should be disabled.
    const btn = screen.getByRole("button", { name: "Play Penguin Run" });
    expect(btn).toBeDisabled();
  });

  it("enables Play once both sprites load successfully", async () => {
    autoResolveImages = false;
    render(<ArcadeSection hasPlayedToday={false} enabled={true} />);

    // Simulate both images loading.
    act(() => {
      for (const img of createdImages) {
        img.onload?.();
      }
    });

    await dismissModal();

    const btn = screen.getByRole("button", { name: "Play Penguin Run" });
    expect(btn).not.toBeDisabled();
  });

  it("does not call the start API when Play is clicked before sprites are loaded", async () => {
    autoResolveImages = false;
    render(<ArcadeSection hasPlayedToday={false} enabled={true} />);

    await dismissModal();

    // Sprites not yet loaded — button is disabled, click should not trigger API.
    const btn = screen.getByRole("button", { name: "Play Penguin Run" });
    await userEvent.click(btn);
    expect(mockFetch).not.toHaveBeenCalledWith(
      "/api/arcade/start",
      expect.anything(),
    );
  });

  it("keeps Play disabled when a sprite fails to load", async () => {
    autoResolveImages = false;
    render(<ArcadeSection hasPlayedToday={false} enabled={true} />);

    await dismissModal();

    // Simulate one image failing.
    act(() => {
      createdImages[0]?.onerror?.();
    });

    const btn = screen.getByRole("button", { name: "Play Penguin Run" });
    expect(btn).toBeDisabled();
  });
});
