import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRouter } from "@/i18n/navigation";
import { useLiveRefresh } from "./use-live-refresh";

vi.mock("@/i18n/navigation", () => ({
  useRouter: vi.fn(),
}));

describe("useLiveRefresh hook", () => {
  let mockRefresh: any;
  let originalVisibilityState: any;

  beforeEach(() => {
    vi.useFakeTimers();
    mockRefresh = vi.fn();
    vi.mocked(useRouter).mockReturnValue({
      refresh: mockRefresh,
    } as any);

    originalVisibilityState = document.visibilityState;
    // Set default visibility to visible
    Object.defineProperty(document, "visibilityState", {
      writable: true,
      configurable: true,
      value: "visible",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    Object.defineProperty(document, "visibilityState", {
      writable: true,
      configurable: true,
      value: originalVisibilityState,
    });
  });

  it("should refresh the router at the cadence when mounted and visible", () => {
    renderHook(() => useLiveRefresh());

    expect(mockRefresh).not.toHaveBeenCalled();

    // Advance by default 30s
    vi.advanceTimersByTime(30_000);
    expect(mockRefresh).toHaveBeenCalledTimes(1);

    // Advance another 30s
    vi.advanceTimersByTime(30_000);
    expect(mockRefresh).toHaveBeenCalledTimes(2);
  });

  it("should respect NEXT_PUBLIC_REFRESH_INTERVAL environment variable", () => {
    const originalEnv = process.env.NEXT_PUBLIC_REFRESH_INTERVAL;
    process.env.NEXT_PUBLIC_REFRESH_INTERVAL = "10000"; // 10s

    renderHook(() => useLiveRefresh());

    vi.advanceTimersByTime(10_000);
    expect(mockRefresh).toHaveBeenCalledTimes(1);

    process.env.NEXT_PUBLIC_REFRESH_INTERVAL = originalEnv;
  });

  it("should stop ticking when hidden and resume when visible again", () => {
    renderHook(() => useLiveRefresh());

    // Hide tab
    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));

    // Advance 30s, should not call refresh
    vi.advanceTimersByTime(30_000);
    expect(mockRefresh).not.toHaveBeenCalled();

    // Make visible again
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));

    // Tick again
    vi.advanceTimersByTime(30_000);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it("should clean up interval and visibility listener on unmount", () => {
    const removeListenerSpy = vi.spyOn(document, "removeEventListener");
    const clearIntervalSpy = vi.spyOn(global, "clearInterval");

    const { unmount } = renderHook(() => useLiveRefresh());

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
    expect(removeListenerSpy).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function),
    );
  });
});
