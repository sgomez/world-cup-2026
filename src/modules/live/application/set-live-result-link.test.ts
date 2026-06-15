import { describe, expect, it } from "vitest";
import { LiveResult } from "../domain/live-result";
import { InMemoryLiveResultRepository } from "../infrastructure/in-memory-live-result-repository";
import { setLiveResultLink } from "./set-live-result-link";

describe("setLiveResultLink application service", () => {
  it("sets the link on an existing record", async () => {
    const existing = LiveResult.fromState({
      num: 1,
      status: "upcoming",
      goals1: 0,
      goals2: 0,
    });
    const repo = new InMemoryLiveResultRepository([existing]);

    const result = await setLiveResultLink(repo, {
      num: 1,
      link: "https://example.com/match/1",
    });

    expect(result.isOk()).toBe(true);
    const saved = await repo.findByNum(1);
    expect(saved?.link).toBe("https://example.com/match/1");
  });

  it("returns NOT_FOUND when record does not exist", async () => {
    const repo = new InMemoryLiveResultRepository();

    const result = await setLiveResultLink(repo, {
      num: 1,
      link: "https://example.com/match/1",
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("NOT_FOUND");
  });

  it("returns INVALID_NUM for out-of-range match number", async () => {
    const repo = new InMemoryLiveResultRepository();

    const result = await setLiveResultLink(repo, {
      num: 999,
      link: "https://example.com/match/999",
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("INVALID_NUM");
  });

  it("does not modify status or goals when setting the link", async () => {
    const existing = LiveResult.fromState({
      num: 1,
      status: "live",
      goals1: 2,
      goals2: 1,
    });
    const repo = new InMemoryLiveResultRepository([existing]);

    await setLiveResultLink(repo, {
      num: 1,
      link: "https://example.com/match/1",
    });

    const saved = await repo.findByNum(1);
    expect(saved?.status).toBe("live");
    expect(saved?.goals1).toBe(2);
    expect(saved?.goals2).toBe(1);
  });
});
