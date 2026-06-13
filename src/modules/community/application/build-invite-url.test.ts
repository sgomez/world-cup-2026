import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildInviteUrl } from "./build-invite-url";

describe("buildInviteUrl", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should use NEXT_PUBLIC_APP_URL if set", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://worldcup.example.com";
    const url = buildInviteUrl("token123");
    expect(url).toBe("https://worldcup.example.com/communities/join/token123");
  });

  it("should handle trailing slash in NEXT_PUBLIC_APP_URL", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://worldcup.example.com/";
    const url = buildInviteUrl("token123");
    expect(url).toBe("https://worldcup.example.com/communities/join/token123");
  });

  it("should fallback to localhost:3000 when NEXT_PUBLIC_APP_URL is not set", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    const url = buildInviteUrl("token123");
    expect(url).toBe("http://localhost:3000/communities/join/token123");
  });
});
