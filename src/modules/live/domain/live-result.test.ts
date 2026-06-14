import { describe, expect, it } from "vitest";
import { hasLiveMatch, LiveResult } from "./live-result";

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

describe("LiveResult.reconcile — upcoming status, adminOverride, and validations", () => {
  it("allows setting status to upcoming if goals are 0 and penalties are undefined", () => {
    const [result, events] = LiveResult.reconcile(null, {
      num: GROUP_NUM,
      status: "upcoming",
      goals1: 0,
      goals2: 0,
    });
    expect(result.isOk()).toBe(true);
    const lr = result._unsafeUnwrap();
    expect(lr.status).toBe("upcoming");
    expect(lr.goals1).toBe(0);
    expect(lr.goals2).toBe(0);
    expect(events).toHaveLength(0); // upcoming doesn't start the match
  });

  it("fails validation if status is upcoming and goals are non-zero", () => {
    const [result] = LiveResult.reconcile(null, {
      num: GROUP_NUM,
      status: "upcoming",
      goals1: 1,
      goals2: 0,
    });
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("INVALID_GOALS");
  });

  it("fails validation if status is upcoming and penalties are defined", () => {
    const [result] = LiveResult.reconcile(null, {
      num: KNOCKOUT_NUM,
      status: "upcoming",
      goals1: 0,
      goals2: 0,
      penalties1: 3,
      penalties2: 2,
    });
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("PENALTIES_NOT_ALLOWED");
  });

  it("ignores finished -> live or finished -> upcoming transition if adminOverride is not true", () => {
    const existing = LiveResult.fromState({
      num: GROUP_NUM,
      status: "finished",
      goals1: 2,
      goals2: 1,
    });

    const [resultLive, eventsLive] = LiveResult.reconcile(existing, {
      num: GROUP_NUM,
      status: "live",
      goals1: 2,
      goals2: 1,
    });
    expect(resultLive.isOk()).toBe(true);
    expect(resultLive._unsafeUnwrap().status).toBe("finished");
    expect(eventsLive).toHaveLength(0);

    const [resultUpcoming, eventsUpcoming] = LiveResult.reconcile(existing, {
      num: GROUP_NUM,
      status: "upcoming",
      goals1: 0,
      goals2: 0,
    });
    expect(resultUpcoming.isOk()).toBe(true);
    expect(resultUpcoming._unsafeUnwrap().status).toBe("finished");
    expect(eventsUpcoming).toHaveLength(0);
  });

  it("allows finished -> live or finished -> upcoming transitions if adminOverride is true", () => {
    const existing = LiveResult.fromState({
      num: GROUP_NUM,
      status: "finished",
      goals1: 2,
      goals2: 1,
    });

    const [resultLive, _eventsLive] = LiveResult.reconcile(
      existing,
      {
        num: GROUP_NUM,
        status: "live",
        goals1: 2,
        goals2: 1,
      },
      true,
    );
    expect(resultLive.isOk()).toBe(true);
    expect(resultLive._unsafeUnwrap().status).toBe("live");

    const [resultUpcoming, _eventsUpcoming] = LiveResult.reconcile(
      existing,
      {
        num: GROUP_NUM,
        status: "upcoming",
        goals1: 0,
        goals2: 0,
      },
      true,
    );
    expect(resultUpcoming.isOk()).toBe(true);
    const lr = resultUpcoming._unsafeUnwrap();
    expect(lr.status).toBe("upcoming");
    expect(lr.goals1).toBe(0);
    expect(lr.goals2).toBe(0);
    expect(lr.penalties1).toBeUndefined();
    expect(lr.penalties2).toBeUndefined();
  });
});

describe("hasLiveMatch predicate", () => {
  it("returns false when no matches are live", () => {
    const results = [
      LiveResult.fromState({
        num: 1,
        status: "finished",
        goals1: 2,
        goals2: 1,
      }),
      LiveResult.fromState({
        num: 2,
        status: "upcoming",
        goals1: 0,
        goals2: 0,
      }),
    ];
    expect(hasLiveMatch(results)).toBe(false);
  });

  it("returns true when any match is live", () => {
    const results = [
      LiveResult.fromState({
        num: 1,
        status: "finished",
        goals1: 2,
        goals2: 1,
      }),
      LiveResult.fromState({ num: 2, status: "live", goals1: 0, goals2: 0 }),
    ];
    expect(hasLiveMatch(results)).toBe(true);
  });

  it("works with plain objects containing status property", () => {
    const results = [{ status: "finished" }, { status: "live" }];
    expect(hasLiveMatch(results as any)).toBe(true);
  });
});

describe("LiveResult.withLink", () => {
  it("returns a new instance with link set", () => {
    const lr = LiveResult.fromState({
      num: 1,
      status: "upcoming",
      goals1: 0,
      goals2: 0,
    });
    const linked = lr.withLink("https://example.com/match/1");
    expect(linked.link).toBe("https://example.com/match/1");
    expect(linked.num).toBe(1);
    expect(linked.status).toBe("upcoming");
  });

  it("does not mutate the original", () => {
    const lr = LiveResult.fromState({
      num: 1,
      status: "upcoming",
      goals1: 0,
      goals2: 0,
    });
    lr.withLink("https://example.com/match/1");
    expect(lr.link).toBeUndefined();
  });

  it("link is carried forward through reconcile", () => {
    const existing = LiveResult.fromState({
      num: 1,
      status: "upcoming",
      goals1: 0,
      goals2: 0,
      link: "https://example.com/match/1",
    });
    const [result] = LiveResult.reconcile(existing, {
      num: 1,
      status: "live",
      goals1: 1,
      goals2: 0,
    });
    expect(result._unsafeUnwrap().link).toBe("https://example.com/match/1");
  });
});
