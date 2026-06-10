import { describe, expect, it } from "vitest";
import { LiveResult } from "../domain/live-result";
import { InMemoryLiveResultRepository } from "../infrastructure/in-memory-live-result-repository";
import { upsertLiveResult } from "./upsert-live-result";

describe("upsertLiveResult application service", () => {
  it("creates a new LiveResult when none exists (PUT semantics)", async () => {
    const repo = new InMemoryLiveResultRepository();

    const result = await upsertLiveResult(repo, {
      num: 1,
      status: "live",
      goals1: 0,
      goals2: 0,
      allowCreate: true,
    });

    expect(result.isOk()).toBe(true);
    const saved = await repo.findByNum(1);
    expect(saved).not.toBeNull();
    expect(saved?.status).toBe("live");
    expect(saved?.goals1).toBe(0);
  });

  it("returns INVALID_NUM for unknown match number", async () => {
    const repo = new InMemoryLiveResultRepository();

    const result = await upsertLiveResult(repo, {
      num: 999,
      status: "live",
      goals1: 0,
      goals2: 0,
      allowCreate: true,
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("INVALID_NUM");
  });

  it("returns NOT_FOUND for PATCH when no row exists", async () => {
    const repo = new InMemoryLiveResultRepository();

    const result = await upsertLiveResult(repo, {
      num: 1,
      status: "live",
      goals1: 1,
      goals2: 0,
      allowCreate: false, // PATCH semantics
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("NOT_FOUND");
  });

  it("merges partial fields for PATCH when row exists", async () => {
    const existing = LiveResult.fromState({
      num: 1,
      status: "live",
      goals1: 1,
      goals2: 0,
    });
    const repo = new InMemoryLiveResultRepository([existing]);

    const result = await upsertLiveResult(repo, {
      num: 1,
      status: "live",
      goals1: 2,
      goals2: 0,
      allowCreate: false, // PATCH
    });

    expect(result.isOk()).toBe(true);
    const saved = await repo.findByNum(1);
    expect(saved?.goals1).toBe(2);
  });

  it("replaces row on PUT regardless", async () => {
    const existing = LiveResult.fromState({
      num: 1,
      status: "live",
      goals1: 1,
      goals2: 0,
    });
    const repo = new InMemoryLiveResultRepository([existing]);

    const result = await upsertLiveResult(repo, {
      num: 1,
      status: "finished",
      goals1: 3,
      goals2: 1,
      allowCreate: true,
    });

    expect(result.isOk()).toBe(true);
    const saved = await repo.findByNum(1);
    expect(saved?.status).toBe("finished");
    expect(saved?.goals1).toBe(3);
  });

  it("returns INVALID_GOALS for negative goals", async () => {
    const repo = new InMemoryLiveResultRepository();

    const result = await upsertLiveResult(repo, {
      num: 1,
      status: "live",
      goals1: -1,
      goals2: 0,
      allowCreate: true,
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("INVALID_GOALS");
  });

  it("returns PENALTIES_NOT_ALLOWED for group matches with penalties", async () => {
    const repo = new InMemoryLiveResultRepository();

    const result = await upsertLiveResult(repo, {
      num: 1, // group match
      status: "finished",
      goals1: 1,
      goals2: 1,
      penalties1: 4,
      penalties2: 3,
      allowCreate: true,
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("PENALTIES_NOT_ALLOWED");
  });

  it("accepts penalties on knockout matches", async () => {
    const repo = new InMemoryLiveResultRepository();

    const result = await upsertLiveResult(repo, {
      num: 73, // knockout
      status: "finished",
      goals1: 1,
      goals2: 1,
      penalties1: 5,
      penalties2: 4,
      allowCreate: true,
    });

    expect(result.isOk()).toBe(true);
    const saved = await repo.findByNum(73);
    expect(saved?.penalties1).toBe(5);
  });

  it("is idempotent — re-sending identical snapshot yields no change", async () => {
    const existing = LiveResult.fromState({
      num: 1,
      status: "live",
      goals1: 1,
      goals2: 2,
    });
    const repo = new InMemoryLiveResultRepository([existing]);

    const result = await upsertLiveResult(repo, {
      num: 1,
      status: "live",
      goals1: 1,
      goals2: 2,
      allowCreate: true,
    });

    expect(result.isOk()).toBe(true);
    // The returned events should be empty (no-op)
    const { events } = result._unsafeUnwrap();
    expect(events).toHaveLength(0);
  });

  it("enforces finished latch — live snapshot for finished match is ignored", async () => {
    const existing = LiveResult.fromState({
      num: 1,
      status: "finished",
      goals1: 2,
      goals2: 0,
    });
    const repo = new InMemoryLiveResultRepository([existing]);

    const result = await upsertLiveResult(repo, {
      num: 1,
      status: "live",
      goals1: 2,
      goals2: 0,
      allowCreate: true,
    });

    expect(result.isOk()).toBe(true);
    const { events } = result._unsafeUnwrap();
    expect(events).toHaveLength(0);
    // Still finished
    const saved = await repo.findByNum(1);
    expect(saved?.status).toBe("finished");
  });
});
