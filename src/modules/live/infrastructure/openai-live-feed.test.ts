import { describe, expect, it } from "vitest";
import type { Match } from "@/modules/schedule";
import { LiveResult } from "../domain/live-result";
import { StubMatchContextResolver } from "./match-context-resolver.stub";
import type { StructuredResponder } from "./openai-live-feed";
import { OpenAiLiveFeed } from "./openai-live-feed";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGroupMatch(overrides: Partial<Match> = {}): Match {
  return {
    num: 1,
    round: "Group A",
    date: "2026-06-11",
    time: "13:00 UTC-6",
    team1: "Mexico",
    team2: "United States",
    ground: "Mexico City",
    group: "Group A",
    ...overrides,
  };
}

function makeKnockoutMatch(overrides: Partial<Match> = {}): Match {
  return {
    num: 73,
    round: "Round of 32",
    date: "2026-06-28",
    time: "12:00 UTC-7",
    team1: "2A",
    team2: "2B",
    ground: "Los Angeles (Inglewood)",
    ...overrides,
  };
}

function makeGroupLiveResult(
  overrides: Partial<Parameters<typeof LiveResult.fromState>[0]> = {},
): LiveResult {
  return LiveResult.fromState({
    num: 1,
    status: "live",
    goals1: 0,
    goals2: 0,
    ...overrides,
  });
}

function makeKnockoutLiveResult(
  overrides: Partial<Parameters<typeof LiveResult.fromState>[0]> = {},
): LiveResult {
  return LiveResult.fromState({
    num: 73,
    status: "live",
    goals1: 0,
    goals2: 0,
    ...overrides,
  });
}

/** A canned StructuredResponder that returns a pre-built payload. */
function cannedResponder(payload: object): StructuredResponder {
  return async (_prompt) => payload;
}

/** A StructuredResponder that throws a network error. */
function networkErrorResponder(): StructuredResponder {
  return async (_prompt) => {
    throw new Error("Network error");
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("OpenAiLiveFeed", () => {
  const model = "gpt-5.4-mini";

  describe("group-stage snapshots (num < 73)", () => {
    it("maps phase=finished → snapshot.finished=true", async () => {
      const resolver = new StubMatchContextResolver();
      const responder = cannedResponder({
        dataFound: true,
        homeTeam: "Mexico",
        awayTeam: "United States",
        phase: "finished",
        minute: null,
        inStoppage: false,
        homeGoals: 2,
        awayGoals: 1,
        homePenalties: null,
        awayPenalties: null,
        sourceUrl: null,
      });

      const feed = new OpenAiLiveFeed(model, resolver, responder);
      const match = makeGroupMatch();
      const result = await feed.fetchSnapshot(match, makeGroupLiveResult());

      expect(result.isOk()).toBe(true);
      const snap = result._unsafeUnwrap();
      expect(snap.finished).toBe(true);
      expect(snap.phase).toBe("finished");
      expect(snap.goals1).toBe(2);
      expect(snap.goals2).toBe(1);
    });

    it("maps homeGoals/awayGoals → goals1/goals2", async () => {
      const resolver = new StubMatchContextResolver();
      const responder = cannedResponder({
        dataFound: true,
        homeTeam: "Mexico",
        awayTeam: "United States",
        phase: "first_half",
        minute: 35,
        inStoppage: false,
        homeGoals: 3,
        awayGoals: 1,
        homePenalties: null,
        awayPenalties: null,
        sourceUrl: null,
      });

      const feed = new OpenAiLiveFeed(model, resolver, responder);
      const result = await feed.fetchSnapshot(
        makeGroupMatch(),
        makeGroupLiveResult(),
      );

      expect(result.isOk()).toBe(true);
      const snap = result._unsafeUnwrap();
      expect(snap.goals1).toBe(3);
      expect(snap.goals2).toBe(1);
    });

    it("passes minute and inStoppage through", async () => {
      const resolver = new StubMatchContextResolver();
      const responder = cannedResponder({
        dataFound: true,
        homeTeam: "Mexico",
        awayTeam: "United States",
        phase: "second_half",
        minute: 78,
        inStoppage: true,
        homeGoals: 0,
        awayGoals: 0,
        homePenalties: null,
        awayPenalties: null,
        sourceUrl: null,
      });

      const feed = new OpenAiLiveFeed(model, resolver, responder);
      const result = await feed.fetchSnapshot(
        makeGroupMatch(),
        makeGroupLiveResult(),
      );

      expect(result.isOk()).toBe(true);
      const snap = result._unsafeUnwrap();
      expect(snap.phase).toBe("second_half");
      expect(snap.minute).toBe(78);
      expect(snap.inStoppage).toBe(true);
    });

    it("strips penalties for group matches regardless of model output", async () => {
      const resolver = new StubMatchContextResolver();
      const responder = cannedResponder({
        dataFound: true,
        homeTeam: "Mexico",
        awayTeam: "United States",
        phase: "finished",
        minute: null,
        inStoppage: false,
        homeGoals: 1,
        awayGoals: 1,
        homePenalties: 4, // model erroneously returns penalties for group match
        awayPenalties: 3,
        sourceUrl: null,
      });

      const feed = new OpenAiLiveFeed(model, resolver, responder);
      const result = await feed.fetchSnapshot(
        makeGroupMatch(),
        makeGroupLiveResult(),
      );

      expect(result.isOk()).toBe(true);
      const snap = result._unsafeUnwrap();
      // Penalties must be stripped for group stage
      expect(snap.penalties1).toBeUndefined();
      expect(snap.penalties2).toBeUndefined();
    });

    it("returns Err when dataFound=false", async () => {
      const resolver = new StubMatchContextResolver();
      const responder = cannedResponder({
        dataFound: false,
        homeTeam: "",
        awayTeam: "",
        phase: "not_started",
        minute: null,
        inStoppage: false,
        homeGoals: 0,
        awayGoals: 0,
        homePenalties: null,
        awayPenalties: null,
        sourceUrl: null,
      });

      const feed = new OpenAiLiveFeed(model, resolver, responder);
      const result = await feed.fetchSnapshot(makeGroupMatch(), null);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().message).toMatch(/dataFound/i);
    });

    it("returns Err on group team-name mismatch (home)", async () => {
      const resolver = new StubMatchContextResolver();
      const responder = cannedResponder({
        dataFound: true,
        homeTeam: "Brazil", // wrong — fixture says Mexico vs United States
        awayTeam: "United States",
        phase: "first_half",
        minute: 30,
        inStoppage: false,
        homeGoals: 1,
        awayGoals: 0,
        homePenalties: null,
        awayPenalties: null,
        sourceUrl: null,
      });

      const feed = new OpenAiLiveFeed(model, resolver, responder);
      const result = await feed.fetchSnapshot(
        makeGroupMatch(),
        makeGroupLiveResult(),
      );

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().message).toMatch(/team.*mismatch/i);
    });

    it("returns Err on group team-name mismatch (away)", async () => {
      const resolver = new StubMatchContextResolver();
      const responder = cannedResponder({
        dataFound: true,
        homeTeam: "Mexico",
        awayTeam: "Argentina", // wrong
        phase: "first_half",
        minute: 30,
        inStoppage: false,
        homeGoals: 0,
        awayGoals: 1,
        homePenalties: null,
        awayPenalties: null,
        sourceUrl: null,
      });

      const feed = new OpenAiLiveFeed(model, resolver, responder);
      const result = await feed.fetchSnapshot(
        makeGroupMatch(),
        makeGroupLiveResult(),
      );

      expect(result.isErr()).toBe(true);
    });

    it("accepts normalized team names (case-insensitive comparison)", async () => {
      const resolver = new StubMatchContextResolver();
      const responder = cannedResponder({
        dataFound: true,
        homeTeam: "mexico", // lowercase — should still pass group guard
        awayTeam: "UNITED STATES",
        phase: "first_half",
        minute: 10,
        inStoppage: false,
        homeGoals: 0,
        awayGoals: 0,
        homePenalties: null,
        awayPenalties: null,
        sourceUrl: null,
      });

      const feed = new OpenAiLiveFeed(model, resolver, responder);
      const result = await feed.fetchSnapshot(
        makeGroupMatch(),
        makeGroupLiveResult(),
      );

      expect(result.isOk()).toBe(true);
    });
  });

  describe("knockout snapshots (num >= 73)", () => {
    it("uses resolver to get team names and returns snapshot", async () => {
      const resolver = new StubMatchContextResolver();
      resolver.set(73, { home: "Brazil", away: "Argentina" });

      const responder = cannedResponder({
        dataFound: true,
        homeTeam: "Brazil",
        awayTeam: "Argentina",
        phase: "second_half",
        minute: 65,
        inStoppage: false,
        homeGoals: 1,
        awayGoals: 0,
        homePenalties: null,
        awayPenalties: null,
        sourceUrl: null,
      });

      const feed = new OpenAiLiveFeed(model, resolver, responder);
      const result = await feed.fetchSnapshot(
        makeKnockoutMatch(),
        makeKnockoutLiveResult(),
      );

      expect(result.isOk()).toBe(true);
      const snap = result._unsafeUnwrap();
      expect(snap.goals1).toBe(1);
      expect(snap.goals2).toBe(0);
    });

    it("returns Err when resolver returns null (participants not yet determinable)", async () => {
      const resolver = new StubMatchContextResolver();
      resolver.set(73, null); // resolver cannot determine participants

      const responder = cannedResponder({
        dataFound: true,
        homeTeam: "Brazil",
        awayTeam: "Argentina",
        phase: "first_half",
        minute: 20,
        inStoppage: false,
        homeGoals: 0,
        awayGoals: 0,
        homePenalties: null,
        awayPenalties: null,
        sourceUrl: null,
      });

      const feed = new OpenAiLiveFeed(model, resolver, responder);
      const result = await feed.fetchSnapshot(makeKnockoutMatch(), null);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().message).toMatch(/resolver/i);
    });

    it("writes penalties for knockout when both present", async () => {
      const resolver = new StubMatchContextResolver();
      resolver.set(73, { home: "Brazil", away: "Argentina" });

      const responder = cannedResponder({
        dataFound: true,
        homeTeam: "Brazil",
        awayTeam: "Argentina",
        phase: "finished",
        minute: null,
        inStoppage: false,
        homeGoals: 1,
        awayGoals: 1,
        homePenalties: 5,
        awayPenalties: 4,
        sourceUrl: null,
      });

      const feed = new OpenAiLiveFeed(model, resolver, responder);
      const result = await feed.fetchSnapshot(
        makeKnockoutMatch(),
        makeKnockoutLiveResult({ num: 73, goals1: 1, goals2: 1 }),
      );

      expect(result.isOk()).toBe(true);
      const snap = result._unsafeUnwrap();
      expect(snap.penalties1).toBe(5);
      expect(snap.penalties2).toBe(4);
    });

    it("echoes stored penalties when model returns null penalties (write-when-present, echo-when-absent)", async () => {
      const resolver = new StubMatchContextResolver();
      resolver.set(73, { home: "Brazil", away: "Argentina" });

      const responder = cannedResponder({
        dataFound: true,
        homeTeam: "Brazil",
        awayTeam: "Argentina",
        phase: "penalties",
        minute: null,
        inStoppage: false,
        homeGoals: 1,
        awayGoals: 1,
        homePenalties: null, // model doesn't know penalties yet
        awayPenalties: null,
        sourceUrl: null,
      });

      const feed = new OpenAiLiveFeed(model, resolver, responder);
      const current = makeKnockoutLiveResult({
        num: 73,
        goals1: 1,
        goals2: 1,
        penalties1: 3, // Admin already entered
        penalties2: 2,
      });

      const result = await feed.fetchSnapshot(makeKnockoutMatch(), current);

      expect(result.isOk()).toBe(true);
      const snap = result._unsafeUnwrap();
      // Must echo the stored Admin values, not wipe them
      expect(snap.penalties1).toBe(3);
      expect(snap.penalties2).toBe(2);
    });

    it("echoes null when no stored penalties and model returns null penalties", async () => {
      const resolver = new StubMatchContextResolver();
      resolver.set(73, { home: "Brazil", away: "Argentina" });

      const responder = cannedResponder({
        dataFound: true,
        homeTeam: "Brazil",
        awayTeam: "Argentina",
        phase: "extra_time",
        minute: 100,
        inStoppage: false,
        homeGoals: 1,
        awayGoals: 1,
        homePenalties: null,
        awayPenalties: null,
        sourceUrl: null,
      });

      const feed = new OpenAiLiveFeed(model, resolver, responder);
      const result = await feed.fetchSnapshot(
        makeKnockoutMatch(),
        makeKnockoutLiveResult({ num: 73, goals1: 1, goals2: 1 }),
      );

      expect(result.isOk()).toBe(true);
      const snap = result._unsafeUnwrap();
      expect(snap.penalties1).toBeUndefined();
      expect(snap.penalties2).toBeUndefined();
    });
  });

  describe("error cases", () => {
    it("returns Err on network/timeout error from responder", async () => {
      const resolver = new StubMatchContextResolver();
      const feed = new OpenAiLiveFeed(model, resolver, networkErrorResponder());
      const result = await feed.fetchSnapshot(makeGroupMatch(), null);
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().message).toMatch(/network error/i);
    });

    it("returns Err when responder returns schema-invalid payload (malformed JSON)", async () => {
      const resolver = new StubMatchContextResolver();
      // Missing required fields
      const responder = cannedResponder({
        dataFound: true,
        // homeTeam missing, awayTeam missing, etc.
        phase: "INVALID_PHASE",
      });

      const feed = new OpenAiLiveFeed(model, resolver, responder);
      const result = await feed.fetchSnapshot(makeGroupMatch(), null);

      expect(result.isErr()).toBe(true);
    });

    it("returns Err when responder returns null payload", async () => {
      const resolver = new StubMatchContextResolver();
      const responder = cannedResponder(null as any);

      const feed = new OpenAiLiveFeed(model, resolver, responder);
      const result = await feed.fetchSnapshot(makeGroupMatch(), null);

      expect(result.isErr()).toBe(true);
    });
  });
});
