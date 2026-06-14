# ADR 0028: Poller 3-Hour Force-Finish

**Status:** Proposed
**Date:** 2026-06-14

**Relates to / partly reverses:** ADR 0019 ("the Poller never decides finishing from a
clock of its own; the feed is the authority on when a match ends").

## Context

ADR 0019 made the **Live Feed** the sole authority on when a match ends, and the Poller
re-polls every `live` match each Tick until the feed reports `finished`. With the
LLM-backed Feed (ADR 0027) two new pressures appear:

1. **Cost / endless polling.** If the feed never returns `finished` for a match (the model
   can't determine full-time, or keeps erroring), the Poller would call the LLM for that
   match every Tick forever.
2. **Stuck-`live` matches break derivation.** A match left `live` indefinitely never
   settles, so **Advanced** state, the knockout winner, and therefore the **Result** never
   derive for it.
3. **Down-site recovery.** If the app (or the feed source) was down for a match's entire
   window, on recovery the match may be `upcoming` or `live` with no real scoreline. We
   must poll the feed at least once on recovery to capture the real final result before
   closing the match out — never finish a match from a timer alone.

## Decision

The Poller force-finishes a still-`live` match once **3 hours past Kickoff**, but only
after a mandatory final poll.

Per match whose **Kickoff** has passed and that is not yet `finished` in our store:

- Auto-start if needed (`upcoming`/absent → `live` at 0–0), then **poll the feed**. Within
  3h of Kickoff this is the normal live poll.
- At or after `Kickoff + 3h`, **always perform one final poll** (this is the
  "call the matcher at least once" guarantee — it grabs the real result if the site was
  down during the match). If, after applying that snapshot, the match is still not
  `finished`, the Poller writes `status = finished` with the last-known/just-polled score,
  latching it so derivation can proceed.

3 hours comfortably exceeds any real match (90 + stoppage + extra time + penalties ≈ 2.5h)
plus kickoff delays.

The Tick's success log changes to report **only live matches**: `processed` counts the
matches for which the feed was actually queried this Tick (auto-started + already `live`),
excluding already-`finished` and not-due matches. A match that goes `live → finished` in
one Tick still counts (it was live work).

## Considered Options

- **Leave `live`, stop polling after 3h.** Rejected: never finalizes a wrong score
  automatically, but the match stays a flashing `live` forever and its bracket slot never
  settles without manual Admin action — worse than a possibly-imperfect auto-finish that
  an Admin can correct.
- **Force-finish on a timer without a final poll.** Rejected: would finalize stale data
  for a match whose real result we missed while the site was down.

## Consequences

- The Feed is still the *primary* finishing authority; the 3h rule is a bounded safety net
  that guarantees every started match eventually settles.
- A force-finished match may carry a wrong or partial score; the Admin override panel and
  the `finished` latch remain the correction path.
- LLM polling for any single match is capped at the `[Kickoff, Kickoff + 3h]` window.
- `processed` in the Tick log now means "live matches worked this Tick," fixing the
  inflated count that previously included every already-finished past-kickoff match.
