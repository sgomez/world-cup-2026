# ADR 0020: worldcup26.ir as a Live Feed Adapter, Selected by Env

**Status:** Proposed
**Date:** 2026-06-11

## Context

ADR 0019 built the **Live Feed Poller** against a `LiveFeed` port and shipped only a
**mock** adapter (synthetic, clock-driven, echoes the stored scoreline). It explicitly
left room for "a real provider [to] drop in behind the same port with no Poller change."
A free third-party API now exists — `https://worldcup26.ir` — that serves real World Cup
2026 scorelines. We want to consume it without disturbing the Poller, the `upsertLiveResult`
command, or anything stored in `bet` (ADR 0015's scoring derives transitively from these
scorelines, so a wrong write corrupts the answer key, the Leaderboard, and the Cup).

Two facts found by probing the live API shaped this:

- `GET /get/games` returns **all 104 games in one response**; the per-`_id`
  `GET /get/game/{mongoId}` is not needed.
- The external `id` is `"1"`..`"104"` and maps **1:1 to our Match Number (`num`)** across the
  *entire* tournament, knockouts included (their `id:73` = "Runner-up A vs Runner-up B" =
  our `num:73` = `2A`/`2B`; `103` = third place, `104` = Final). The list even carries
  `home_team_name_en`/`away_team_name_en`, so neither their numeric `team_id`s nor a
  `teams.json` map is required.

The payload has **no penalty-shootout field** (only `home_score`/`away_score`,
`home_scorers`/`away_scorers`), and the tournament's knockout phase is weeks away.

## Decision

Add a **provider-named adapter** `Worldcup26LiveFeed` (`src/modules/live/infrastructure/`)
implementing the existing `LiveFeed` port unchanged. Selection is by env; the Poller,
the port, and `upsertLiveResult` are all untouched.

- **Env switch, fail-safe to mock.** `LIVE_FEED_SOURCE` ∈ {`mock`, `worldcup26`}, **default
  `mock`** — unset or unknown resolves to the synthetic mock, never accidental real traffic.
  `LIVE_FEED_BASE_URL` (default `https://worldcup26.ir`) keeps the host out of the adapter.
  A `createLiveFeed({ source, baseUrl }, clock)` factory maps the env to the concretion;
  `instrumentation.ts` calls the factory instead of `new MockLiveFeed`. Both adapters depend
  only on the `LiveFeed` abstraction (DIP) — migrating to a third provider is a new
  provider-named sibling, not a Poller change.

- **`id === num`, validated, never blindly trusted.** The adapter keys incoming games on
  `id`→`num` but **cross-checks** each against the static `data/worldcup.json` fixture
  (group agreement) and **skips + logs** a mismatch rather than write a wrong score. The
  whole answer key derives from these scorelines, so a silent upstream id drift must fail
  closed, not corrupt scoring. *Rejected:* blind trust of `id` (a feed reorder writes wrong
  scores silently).

- **Per-tick cache behind the unchanged per-match port.** The port stays
  `fetchSnapshot(match, current)`. The adapter fetches `/get/games` **once**, memoizes the
  parsed `num`→game map with a ~60s TTL (below the tick interval), and answers each
  `fetchSnapshot` from cache — ~1 HTTP call per Tick instead of N. *Rejected:* adding a batch
  method to the port (changes the port, the mock, and the Poller loop — blast radius on code
  just shipped, for one round-trip saved; the cache is an adapter concern the domain need not
  know).

- **Feed owns `finished` only; Kickoff still owns start.** `snapshot.finished =
  (game.finished === "TRUE")`. Start stays Kickoff-clock-driven as in ADR 0019; `time_elapsed`
  is **ignored for now** (its parse boundary is kept for a future live-minute display, which
  would cost a `LiveFeedSnapshot` field + a Prisma migration + an event-payload decision).

- **The feed never writes penalties; it echoes `current.penalties`.** External has no
  shootout data, and `reconcile` *strips* penalties from a target that omits them — so the
  adapter passes `current.penalties1/2` straight through, exactly as the mock does, so no Tick
  can ever wipe an Admin-entered shootout. The full knockout-shootout input flow is
  **deferred** (weeks of runway); penalties remain an Admin-only input as in ADR 0015.

- **Resilience (neverthrow, ADR 0009).** An `AbortController` ~10s timeout, non-200 /
  unreachable / zod-invalid payload → `Err`; the Tick records and skips, every live match that
  Tick failing **uniformly** and self-healing on the next Tick. No stale-cache fallback —
  stale scores are worse than a skipped Tick. A `fetch`-like dependency is injected (default
  `globalThis.fetch`) so unit tests are deterministic and offline (TDD).

## Consequences

- The codebase gains its first real external data dependency. The `id === num` coupling is
  load-bearing for the entire derived answer key; the validation guard is the only thing
  standing between an upstream reorder and corrupted scoring.
- Penalties are a **known, intentional gap** until the knockout phase: the `worldcup26` feed
  reports a knockout draw's scoreline (e.g. 1-1 `finished`) but not the shootout winner, so
  such a tie sits `TBD` until an Admin enters penalties. Resolved in a later ADR.
- Goals follow ADR 0019 **last-write-wins**: an Admin goal-correction on a still-live match
  can be reverted by the next Tick if the real feed disagrees (bot-lock still deferred YAGNI).
  Penalties are safe because the feed never writes them.
- `data/worldcup.json`, the id space, and everything in `bet` are untouched — no migration,
  no map, no fixture change.
