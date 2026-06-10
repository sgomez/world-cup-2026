import { describe, expect, it } from "vitest";
import { LiveResult } from "./live-result";

// Match nums: 1-72 = group stage, 73-104 = knockout
const GROUP_NUM = 1;
const KNOCKOUT_NUM = 73;

describe("LiveResult.reconcile — group match", () => {
  it("no row → live snapshot emits MatchStarted", () => {
    const [result, events] = LiveResult.reconcile(null, {
      num: GROUP_NUM,
      status: "live",
      goals1: 0,
      goals2: 0,
    });
    expect(result.isOk()).toBe(true);
    const lr = result._unsafeUnwrap();
    expect(lr.status).toBe("live");
    expect(lr.goals1).toBe(0);
    expect(lr.goals2).toBe(0);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("MatchStarted");
    expect(events[0].num).toBe(GROUP_NUM);
  });

  it("no row → finished snapshot emits MatchStarted + MatchFinished", () => {
    const [result, events] = LiveResult.reconcile(null, {
      num: GROUP_NUM,
      status: "finished",
      goals1: 2,
      goals2: 1,
    });
    expect(result.isOk()).toBe(true);
    const lr = result._unsafeUnwrap();
    expect(lr.status).toBe("finished");
    expect(events.map((e) => e.type)).toEqual([
      "MatchStarted",
      "MatchFinished",
    ]);
  });

  it("live → goals change emits MatchScoreChanged", () => {
    const existing = LiveResult.fromState({
      num: GROUP_NUM,
      status: "live",
      goals1: 0,
      goals2: 0,
    });
    const [result, events] = LiveResult.reconcile(existing, {
      num: GROUP_NUM,
      status: "live",
      goals1: 1,
      goals2: 0,
    });
    expect(result.isOk()).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("MatchScoreChanged");
    const e = events[0] as {
      type: "MatchScoreChanged";
      goals1: number;
      goals2: number;
    };
    expect(e.goals1).toBe(1);
    expect(e.goals2).toBe(0);
  });

  it("live → finished emits MatchFinished", () => {
    const existing = LiveResult.fromState({
      num: GROUP_NUM,
      status: "live",
      goals1: 1,
      goals2: 1,
    });
    const [result, events] = LiveResult.reconcile(existing, {
      num: GROUP_NUM,
      status: "finished",
      goals1: 1,
      goals2: 1,
    });
    expect(result.isOk()).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("MatchFinished");
  });

  it("finished → live snapshot is ignored (finished latch)", () => {
    const existing = LiveResult.fromState({
      num: GROUP_NUM,
      status: "finished",
      goals1: 2,
      goals2: 0,
    });
    const [result, events] = LiveResult.reconcile(existing, {
      num: GROUP_NUM,
      status: "live",
      goals1: 2,
      goals2: 0,
    });
    expect(result.isOk()).toBe(true);
    const lr = result._unsafeUnwrap();
    // State unchanged — still finished
    expect(lr.status).toBe("finished");
    expect(events).toHaveLength(0);
  });

  it("finished → finished correction is accepted", () => {
    const existing = LiveResult.fromState({
      num: GROUP_NUM,
      status: "finished",
      goals1: 1,
      goals2: 0,
    });
    const [result, events] = LiveResult.reconcile(existing, {
      num: GROUP_NUM,
      status: "finished",
      goals1: 2,
      goals2: 0,
    });
    expect(result.isOk()).toBe(true);
    const lr = result._unsafeUnwrap();
    expect(lr.goals1).toBe(2);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("MatchFinished");
  });

  it("identical snapshot is a no-op — no events", () => {
    const existing = LiveResult.fromState({
      num: GROUP_NUM,
      status: "live",
      goals1: 1,
      goals2: 2,
    });
    const [result, events] = LiveResult.reconcile(existing, {
      num: GROUP_NUM,
      status: "live",
      goals1: 1,
      goals2: 2,
    });
    expect(result.isOk()).toBe(true);
    expect(events).toHaveLength(0);
  });

  it("rejects negative goals", () => {
    const [result] = LiveResult.reconcile(null, {
      num: GROUP_NUM,
      status: "live",
      goals1: -1,
      goals2: 0,
    });
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("INVALID_GOALS");
  });

  it("rejects penalties on group matches (num < 73)", () => {
    const [result] = LiveResult.reconcile(null, {
      num: GROUP_NUM,
      status: "finished",
      goals1: 1,
      goals2: 1,
      penalties1: 4,
      penalties2: 3,
    });
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("PENALTIES_NOT_ALLOWED");
  });
});

describe("LiveResult.reconcile — asymmetric penalties", () => {
  it("rejects penalties1 without penalties2 on a knockout match", () => {
    const [result] = LiveResult.reconcile(null, {
      num: KNOCKOUT_NUM,
      status: "finished",
      goals1: 1,
      goals2: 1,
      penalties1: 5,
    });
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("PENALTIES_NOT_ALLOWED");
  });

  it("rejects penalties2 without penalties1 on a knockout match", () => {
    const [result] = LiveResult.reconcile(null, {
      num: KNOCKOUT_NUM,
      status: "finished",
      goals1: 1,
      goals2: 1,
      penalties2: 3,
    });
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("PENALTIES_NOT_ALLOWED");
  });
});

describe("LiveResult.reconcile — knockout match", () => {
  it("accepts penalties on knockout matches (num >= 73)", () => {
    const [result, events] = LiveResult.reconcile(null, {
      num: KNOCKOUT_NUM,
      status: "finished",
      goals1: 1,
      goals2: 1,
      penalties1: 5,
      penalties2: 4,
    });
    expect(result.isOk()).toBe(true);
    const lr = result._unsafeUnwrap();
    expect(lr.penalties1).toBe(5);
    expect(lr.penalties2).toBe(4);
    expect(events.map((e) => e.type)).toEqual([
      "MatchStarted",
      "MatchPenaltiesChanged",
      "MatchFinished",
    ]);
  });

  it("emits MatchPenaltiesChanged when penalty pair changes while live", () => {
    const existing = LiveResult.fromState({
      num: KNOCKOUT_NUM,
      status: "live",
      goals1: 1,
      goals2: 1,
      penalties1: 3,
      penalties2: 2,
    });
    const [result, events] = LiveResult.reconcile(existing, {
      num: KNOCKOUT_NUM,
      status: "live",
      goals1: 1,
      goals2: 1,
      penalties1: 4,
      penalties2: 2,
    });
    expect(result.isOk()).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("MatchPenaltiesChanged");
  });

  it("no row → finished knockout with penalties emits MatchStarted + MatchPenaltiesChanged + MatchFinished", () => {
    const [result, events] = LiveResult.reconcile(null, {
      num: KNOCKOUT_NUM,
      status: "finished",
      goals1: 0,
      goals2: 0,
      penalties1: 3,
      penalties2: 2,
    });
    expect(result.isOk()).toBe(true);
    expect(events.map((e) => e.type)).toEqual([
      "MatchStarted",
      "MatchPenaltiesChanged",
      "MatchFinished",
    ]);
  });
});
