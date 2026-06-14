# ADR 0027: LLM-Backed Live Feed (OpenAI Web Search)

**Status:** Proposed
**Date:** 2026-06-14

**Relates to:** ADR 0019 (Live Feed port and Poller). **Supersedes** the never-built
`worldcup26.ir` adapter plan (the free third-party API proved unreliable — "problems with
the site").

## Context

The **Live Feed** (ADR 0019) is a port; the only adapter is the mock that echoes the
stored scoreline and fakes `finished` from a 120-minute timer. There is still no path to
real World Cup 2026 scores. A free third-party scoreline API (`worldcup26.ir`) was the
planned real adapter, but the site is unreliable, so that plan is dropped.

We want a real Feed that needs no bespoke per-provider scraping and no maintained fixture
id-map: an LLM with web search reads the current state of a match from the open web and
returns it as structured JSON. This also lets us capture richer data the mock cannot —
the **Match Phase**, the **Live Minute**, and knockout penalty-shootout scores.

The risk is correctness: the entire **Result**, **Leaderboard**, and **Cup** derive from
**LiveResults**, so a hallucinated or wrong-fixture read corrupts the answer key. The
design is built around containing that risk.

## Decision

Add an `OpenAiLiveFeed` adapter in the `live` module's infrastructure layer implementing
the unchanged `LiveFeed` port. It is selected by configuration alongside the mock; the
Poller, `upsertLiveResult`, and the domain do not change (DIP).

- **One structured Responses call per `live` match.** The adapter issues a single OpenAI
  Responses API request with the hosted `web_search` tool **and** a strict `json_schema`
  output, asking for the current scoreline, **Match Phase**, **Live Minute** (+ a stoppage
  flag), `finished`, and — for knockouts — the penalty-shootout score. We proceed on the
  assumption the combined `web_search` + structured-output request is supported; if OpenAI
  rejects the combination this is the first thing to revisit.

- **Model via env, web-search-capable default.** `LIVE_FEED_MODEL` selects the model
  (default a confirmed web-search model, e.g. `gpt-5.4-mini`). `gpt-5-nano` is *not*
  documented to support the hosted `web_search` tool; the env lets prod try cheaper models
  without a code change. *Rejected:* hardcoding `gpt-5-nano` (dies if the tool rejects it).

- **Match identity — real team names for every match.** Group-stage matches are identified
  to the model by their real `team1`/`team2` (from `data/worldcup.json`) plus `date`, venue,
  and competition. Knockout fixtures carry only slot codes (`2A`, `W101`), but by the time a
  knockout match is `live` its feeding groups are **always settled** (the schedule completes
  every group before any knockout kicks off), so the participants are always derivable. An
  injected **MatchContext resolver** (backed by `deriveResult` over `finished` LiveResults,
  memoized per Tick) resolves them and the adapter injects the real names into the prompt for
  every match — the prompt shape is uniform. There is no `date+venue` web-identification
  fallback; if the resolver unexpectedly cannot resolve a knockout match, the snapshot is an
  `Err` (skip + log), never a web-guessed identity.

- **Hallucination guard — validate group, trust knockout.** The model returns the teams it
  found. For group matches they must match the fixture's `team1`/`team2` (normalized) or
  the snapshot is an `Err`, skipped and logged — the guard that protects the answer key
  (analogous to 207's id-validation). Knockout teams come from our own bracket derivation
  and cannot be independently re-verified, so the model's reading keyed on the injected
  participants is trusted. The asymmetry is accepted and documented.

- **Penalties: write-when-present, echo-when-absent.** For knockout matches the adapter
  writes `penalties1/2` when the model returns them; when it does not, it echoes
  `current.penalties1/2` so a normal Tick never wipes an Admin-entered shootout. Penalties
  on group matches (`num < 73`) are stripped at the boundary, since `reconcile` rejects
  them. Once a match is `finished` the latch stops re-polling, so an Admin's final
  correction is safe; while `live`, last-write-wins applies (same caveat as goals).

- **Config + factory, fail-safe.** `LIVE_FEED_SOURCE ∈ {mock, openai}` (default `mock` for
  unset/unknown). A `createLiveFeed` factory maps config to the concrete Feed and is
  unit-tested; `instrumentation.ts` calls it instead of constructing the mock directly. If
  `LIVE_FEED_SOURCE=openai` but `OPENAI_API_KEY` is missing, the factory falls back to the
  mock and logs a loud warning rather than crashing the app.

- **Resilience via neverthrow** (ADR 0009): non-200, network/timeout, schema-invalid
  payload, and the group team-name mismatch each return `Err`; the Tick records and skips,
  self-healing next Tick. On `Err` no write occurs, so the stored scoreline is preserved
  (echo-equivalent safety).

- **Injected responder for tests.** The adapter depends on a thin
  `getStructuredResponse(prompt, schema)` interface defaulting to a real OpenAI-SDK-backed
  implementation, so adapter tests are offline and deterministic with canned JSON.

## Consequences

- A new dependency: the `openai` SDK and `OPENAI_API_KEY` (set in prod).
- The `live` Feed now reads from the bracket derivation (via the resolver) to name
  knockout participants — a controlled, one-direction-per-Tick read of the previous Tick's
  derived state; not a runtime cycle.
- Per-`live`-match LLM cost is bounded by the **Match Number** count, the Tick interval,
  and the 3h poll cutoff (ADR 0028).
- Trusting an LLM for the answer key is a deliberate, documented risk; the group guard,
  the `finished` latch, and the Admin override panel are the backstops.
