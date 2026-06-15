import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildShareUrl } from "./build-share-url";

describe("buildShareUrl", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should build a share url with the correct path", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://worldcup.example.com";
    const url = buildShareUrl({ slug: "my-community", locale: "en" });
    expect(url).toMatch(
      /^https:\/\/worldcup\.example\.com\/share\/my-community\?t=\d+$/,
    );
  });

  it("should prefix locale when not the default", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://worldcup.example.com";
    const url = buildShareUrl({ slug: "mi-comunidad", locale: "es" });
    expect(url).toMatch(
      /^https:\/\/worldcup\.example\.com\/es\/share\/mi-comunidad\?t=\d+$/,
    );
  });

  it("should handle trailing slash in NEXT_PUBLIC_APP_URL", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://worldcup.example.com/";
    const url = buildShareUrl({ slug: "my-community", locale: "en" });
    expect(url).toMatch(
      /^https:\/\/worldcup\.example\.com\/share\/my-community\?t=\d+$/,
    );
  });

  it("should fallback to localhost:3000 when NEXT_PUBLIC_APP_URL is not set", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    const url = buildShareUrl({ slug: "my-community", locale: "en" });
    expect(url).toMatch(
      /^http:\/\/localhost:3000\/share\/my-community\?t=\d+$/,
    );
  });

  it("should include a minute-floored timestamp", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://worldcup.example.com";
    const before = Math.floor(Date.now() / 60000);
    const url = buildShareUrl({ slug: "my-community", locale: "en" });
    const after = Math.floor(Date.now() / 60000);

    const match = url.match(/\?t=(\d+)$/);
    expect(match).not.toBeNull();
    const t = Number(match![1]);
    expect(t).toBeGreaterThanOrEqual(before);
    expect(t).toBeLessThanOrEqual(after);
  });

  it("should produce the same url within the same minute", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://worldcup.example.com";
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    const url1 = buildShareUrl({ slug: "my-community", locale: "en" });
    const url2 = buildShareUrl({ slug: "my-community", locale: "en" });
    expect(url1).toBe(url2);
    vi.restoreAllMocks();
  });
});
