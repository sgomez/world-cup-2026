# ADR 0001: Bet Status Is User Intent, Not Temporal State

**Status:** Accepted  
**Date:** 2026-06-05

## Context

Bets have two kinds of "frozen" state:
1. The user explicitly locks their bet (`closed`)
2. The Bet Deadline passes (2026-06-11 19:00 UTC), after which no mutations are permitted

We needed to decide whether these two concepts should be unified (deadline auto-promotes drafts to `closed`) or kept separate.

## Decision

`draft` and `closed` are user-intent states only. The Bet Deadline is a separate, temporal enforcement layer. After the deadline, all bets — regardless of status — become read-only. A bet can remain in `draft` status after the deadline; it is simply frozen there.

## Alternatives Considered

**Auto-promote drafts to `closed` at deadline.** When the deadline passes, a background job or lazy-evaluation check would flip all `draft` bets to `closed`. Rejected because it conflates two distinct concepts: the user's deliberate locking action and the competition's time boundary. A `closed` bet after this change could mean either "user chose to lock it" or "the window expired" — indistinguishable in the data.

## Consequences

- The `status` field on `Bet` only ever changes via explicit user action (close / re-open), never automatically.
- Deadline enforcement is a pure time-check on every write operation, independent of status.
- Queries that need "is this bet still editable?" must check **both** conditions: `status === 'draft'` AND `now < deadline`.
