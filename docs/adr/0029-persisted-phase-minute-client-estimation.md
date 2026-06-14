# ADR 0029: Persisted Match Phase & Live Minute with Client-Side Estimation

**Status:** Proposed
**Date:** 2026-06-14

**Relates to:** ADR 0027 (the LLM Feed that sources this data), ADR 0015 (LiveResult), ADR
0003 (backward-compatible migrations).

## Context

The LLM-backed **Live Feed** (ADR 0027) can report a match's **Match Phase** (not started,
first half, second half, extra time, penalties, finished) and **Live Minute** (`32'`,
`90+`). Issue 207 deferred surfacing this. We now want it shown on the calendar's live
marker.

The Poller ticks only every few minutes, so a stored minute would read stale (a 5-minute-old
`32'`). We want the displayed clock to advance between Ticks without extra writes.

## Decision

Persist **Match Phase** and a stoppage flag plus the **Live Minute** observed at the last
write on the **LiveResult**, and let the client extrapolate the ticking minute from the
existing `updatedAt` anchor.

- **Schema (backward-compatible, ADR 0003).** Add nullable `phase`, `minute`, and an
  in-stoppage flag to the LiveResult store and to `LiveFeedSnapshot`. The `finished` flag
  is kept (the adapter derives it as `phase === 'finished'`), so the finished latch and
  every existing test are untouched.

- **Client-side estimation.** The displayed minute is
  `clampToPhase(minute + floor((now − updatedAt) / 60s))`. The client clamps at the phase
  ceiling — first half → `45+`, second half → `90+`, extra time → `120+` — shown as a
  stoppage marker (no added-minute number, since added time can't be extrapolated). The
  clock does not advance during `penalties` (no minute shown) or `not_started` (`0'`).

- **Stoppage flag only, no added minutes.** We capture *that* the match is in stoppage, not
  the `+n`; the number would drift within a Tick anyway.

- **Auto-started but not-yet-kicked-off.** The Poller auto-starts a match to `live` at
  Kickoff, but the feed may report the real match hasn't started. We keep it `live` and
  display `0'` (phase `not_started`) rather than reverting the status.

## Considered Options

- **Do not persist; ask the model only to sharpen `finished`/penalties.** Smallest blast
  radius, but gives the calendar no live minute — rejected because showing the minute is
  the goal.
- **Store a precomputed display string each Tick.** Rejected: goes stale immediately and
  forces a write every Tick just to advance the clock.
- **Capture added minutes (`45+2`).** Rejected: precise only at the anchor instant, drifts
  within the Tick, and adds a field for no durable value.

## Consequences

- The bracket/calendar gains a self-advancing live minute with no extra writes between
  Ticks; the estimate is approximate near period boundaries (clamped) and is a display
  concern only — **Match Phase**/**Live Minute** never feed **Score**, **Advanced**, or the
  **Result**.
- A new nullable column set; old rows and the mock (which supplies no phase/minute) render
  as a plain `live` marker with no minute.
