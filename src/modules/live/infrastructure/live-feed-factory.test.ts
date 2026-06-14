import { afterEach, describe, expect, it, vi } from "vitest";
import { MockLiveFeed } from "./mock-live-feed";
import { OpenAiLiveFeed } from "./openai-live-feed";

// We'll import the factory after mocking its dependencies.
// The factory creates a ProductionMatchContextResolver and an OpenAiLiveFeed.

// Mock console.warn so we can assert on loud warnings.
const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

afterEach(() => {
  warnSpy.mockClear();
});

describe("createLiveFeed factory", () => {
  it("returns MockLiveFeed when source=mock", async () => {
    const { createLiveFeed } = await import("./live-feed-factory");
    const clock = { now: () => new Date() };
    const result = createLiveFeed(
      { source: "mock", model: "gpt-5.4-mini" },
      { clock, repo: null as any },
    );
    expect(result).toBeInstanceOf(MockLiveFeed);
  });

  it("returns MockLiveFeed when source is undefined (unset)", async () => {
    const { createLiveFeed } = await import("./live-feed-factory");
    const clock = { now: () => new Date() };
    const result = createLiveFeed(
      { source: undefined, model: "gpt-5.4-mini" },
      { clock, repo: null as any },
    );
    expect(result).toBeInstanceOf(MockLiveFeed);
  });

  it("returns MockLiveFeed for unknown source value", async () => {
    const { createLiveFeed } = await import("./live-feed-factory");
    const clock = { now: () => new Date() };
    const result = createLiveFeed(
      { source: "unknown_source" as any, model: "gpt-5.4-mini" },
      { clock, repo: null as any },
    );
    expect(result).toBeInstanceOf(MockLiveFeed);
  });

  it("returns OpenAiLiveFeed when source=openai and API key present", async () => {
    const { createLiveFeed } = await import("./live-feed-factory");
    const result = createLiveFeed(
      { source: "openai", model: "gpt-5.4-mini", apiKey: "sk-test-key" },
      { clock: { now: () => new Date() }, repo: null as any },
    );
    expect(result).toBeInstanceOf(OpenAiLiveFeed);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("falls back to MockLiveFeed with loud warning when source=openai but API key missing", async () => {
    const { createLiveFeed } = await import("./live-feed-factory");
    const clock = { now: () => new Date() };
    const result = createLiveFeed(
      { source: "openai", model: "gpt-5.4-mini", apiKey: undefined },
      { clock, repo: null as any },
    );
    expect(result).toBeInstanceOf(MockLiveFeed);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("OPENAI_API_KEY"),
    );
  });

  it("falls back to MockLiveFeed with loud warning when source=openai but API key is empty string", async () => {
    const { createLiveFeed } = await import("./live-feed-factory");
    const clock = { now: () => new Date() };
    const result = createLiveFeed(
      { source: "openai", model: "gpt-5.4-mini", apiKey: "" },
      { clock, repo: null as any },
    );
    expect(result).toBeInstanceOf(MockLiveFeed);
    expect(warnSpy).toHaveBeenCalled();
  });
});
