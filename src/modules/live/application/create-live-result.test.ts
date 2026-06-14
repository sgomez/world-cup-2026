import { describe, expect, it } from "vitest";
import { LiveResult } from "../domain/live-result";
import { InMemoryLiveResultRepository } from "../infrastructure/in-memory-live-result-repository";
import { createLiveResult } from "./create-live-result";

describe("createLiveResult application service", () => {
  it("creates a new LiveResult with upcoming status and 0-0", async () => {
    const repo = new InMemoryLiveResultRepository();

    const result = await createLiveResult(repo, { num: 1 });

    expect(result.isOk()).toBe(true);
    const saved = await repo.findByNum(1);
    expect(saved?.status).toBe("upcoming");
    expect(saved?.goals1).toBe(0);
    expect(saved?.goals2).toBe(0);
  });

  it("stores the link when provided", async () => {
    const repo = new InMemoryLiveResultRepository();

    await createLiveResult(repo, {
      num: 1,
      link: "https://example.com/match/1",
    });

    const saved = await repo.findByNum(1);
    expect(saved?.link).toBe("https://example.com/match/1");
  });

  it("returns ALREADY_EXISTS when record exists", async () => {
    const existing = LiveResult.fromState({
      num: 1,
      status: "live",
      goals1: 1,
      goals2: 0,
    });
    const repo = new InMemoryLiveResultRepository([existing]);

    const result = await createLiveResult(repo, { num: 1 });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("ALREADY_EXISTS");
  });

  it("returns INVALID_NUM for out-of-range match number", async () => {
    const repo = new InMemoryLiveResultRepository();

    const result = await createLiveResult(repo, { num: 999 });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("INVALID_NUM");
  });

  it("returns INVALID_NUM for match number 0", async () => {
    const repo = new InMemoryLiveResultRepository();

    const result = await createLiveResult(repo, { num: 0 });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("INVALID_NUM");
  });
});
