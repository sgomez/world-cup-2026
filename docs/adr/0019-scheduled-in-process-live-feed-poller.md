# ADR 0019: Scheduled In-Process Live Feed Poller

**Status:** Proposed
**Date:** 2026-06-11

## Context

LiveResults (ADR 0015/0016) have two writers — the external bot over HTTP and the Admin
panel. Both are manual pushers: a match only starts, updates, or finishes when something
deliberately writes it. We want matches to start, tick, and finish automatically during
the tournament with no human intervention and **no real data feed yet built**, so the
calendar and standings come alive on their own. The eventual score-providing feed does
not exist; neither does the bot.

## Decision

Add a **Live Feed Poller** — a scheduled, in-process job. Not a separate container, not
the HTTP bot.

- **Where it runs.** A `croner` schedule started from `instrumentation.ts` (guarded to the
  nodejs runtime), interval from env `LIVE_TICK_CRON` (default `*/5 * * * *`), pinned to
  `timezone: "UTC"`, with `protect: true` to skip overlapping runs. It calls a
  `tickLiveFeed` use-case in `src/modules/live/application/` **directly** — no HTTP, no
  token. This reuses the existing `upsertLiveResult` command, making the Poller a third
  trigger of the one command, not a new write path. *Rejected:* a separate scheduler/cron
  container (an extra image + token plumbing for no gain at one replica) and an in-process
  `setInterval` (no overlap guard / cron syntax). The in-process cost — double-fire if the
  app scales past one replica — is accepted; the deployment runs a single app instance and
  a DB advisory lock is the deferred fix.

- **What a Tick does.** (1) *Auto-start:* any match whose **Kickoff** has passed and that
  is not started (no LiveResult, or one in `upcoming`) → `live` at 0–0. (2) *Poll:* for
  each `live` match, read the **Live Feed** and apply the returned snapshot. Errors are
  modeled with **neverthrow** (ADR 0009), not exceptions: `fetchSnapshot`, kickoff
  parsing, and the upsert each return a `Result`, and the Tick processes matches
  independently — a match returning `Err` is recorded and skipped, never aborting the
  sweep (no `combine` short-circuit). Only genuinely unexpected throws are wrapped at the
  boundary via `ResultAsync.fromPromise`. The Tick is idempotent, so skips self-heal next
  run. A `Clock` is injected for deterministic tests.

- **Kickoff parsing — timezone-explicit.** The server runs UTC and developer machines run
  CEST; nothing may depend on system-local time. A pure `getKickoffInstant(match)` in
  `src/lib/` resolves a match's `date` + timezone-bearing `time` (`"13:00 UTC-6"`) to an
  absolute instant by carrying the offset through to the `Date`, so it yields the
  identical instant on a UTC server and a CEST laptop. It extracts the offset-aware parse
  currently inlined client-side in `match-card.tsx`. (The croner schedule is separately
  pinned to UTC for the same reason.)

- **The Live Feed is a port; the feed owns finishing.** `fetchSnapshot(match, current)`
  returns a `Result` of `{ goals1, goals2, finished, penalties? }`. The current **mock**
  adapter *echoes the stored scoreline* — so `upsertLiveResult`'s no-op guard means a Tick
  never resets an Admin correction with placeholder data — and computes `finished` from a
  hardcoded 120-minute duration past Kickoff. The Poller never decides finishing from a
  clock of its own; the feed is the authority on when a match ends, so a real provider
  drops in behind the same port with no Poller change. *Rejected:* the Poller writing a
  fixed 0–0 (resets Admin edits every Tick) and the Poller owning the clock-based finish
  (duplicates timing the real feed will own).

## Consequences

- Poller-vs-Admin races resolve **last-write-wins** (ADR 0015); the per-match bot-lock
  stays a deferred YAGNI. With the echo mock the race is harmless — score writes no-op.
- The **finished latch** still bars the Poller from un-finishing a match; an Admin can
  override via the admin path.
- The mock's 120-minute constant and echo behavior are throwaway: they disappear when the
  real feed arrives. Only `LIVE_TICK_CRON` and the feed port survive.
