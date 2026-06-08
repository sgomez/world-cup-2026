# ADR 0011: Peer Bet Viewing Is a Community-Scoped Route, Not a Guard on `/bets/[id]`

**Status:** Accepted
**Date:** 2026-06-08

## Context

After the **Bet Deadline**, a Community Member may view a fellow Member's
**closed** Bet in read-only mode (see CONTEXT.md → *Community Member*). The
Leaderboard and Community Detail pages each need a "view bet" affordance that
opens another user's prediction.

The existing owner-facing page `/bets/[id]` had **no peer-authorization gate** —
any authenticated user could open any Bet by ID, including drafts. Introducing a
view button would make that leak trivially reachable, so authorization had to be
added somewhere.

Two homes were possible:

1. **Guard `/bets/[id]`** — keep one Bet route and branch its authorization:
   owner OR (shares a Community with the owner AND Bet closed AND past deadline).
2. **A new community-scoped route** — `/communities/[slug]/bets/[betId]` whose
   authorization is anchored on the `[slug]` Community membership.

## Decision

Peer bet viewing lives at a **new community-scoped route**
`/communities/[slug]/bets/[betId]`. Authorization is expressed in terms the
route already owns:

- the viewer must be a Member of `[slug]`, and
- the Bet owner must be a Member of `[slug]`, and
- the Bet must be `closed` **and** past the Bet Deadline.

If those hold, the route renders `BetPrediction` with `isOwner={false}`
(read-only — see `bet-prediction.tsx:44`, `readOnly = !isOwner || isClosed`).
A closed Bet viewed before the deadline renders a "hidden until deadline" gate
page. A draft, or a Bet whose owner is not in the Community, is a 404.

`/bets/[id]` stays **owner-only** and editable; the owner's own row on the
Leaderboard / Community Detail links there directly. Peer rows link to the
community-scoped route.

## Alternatives Considered

**Guard `/bets/[id]` with a peer branch.** Rejected. The Bet route would have to
reach into Community membership to decide access, coupling the Bet read path to
the Community context and overloading a single URL with two distinct intents
(edit-my-bet vs read-a-peer's-bet). Authorization scoped to "which Community am I
viewing this through" is clearer when it sits under `/communities/[slug]/`, and
the membership check is local to the route's own parameter.

## Consequences

- The peer-view authorization is co-located with Community membership, not the
  Bet aggregate. A Bet shared across several Communities is reachable through
  each `[slug]` it belongs to; the URL records the lens it was viewed through.
- `/bets/[id]` remains a pure owner/edit surface — no peer branch, no
  Community awareness.
- The view gate keys on the **Bet Deadline**, not **Competition End** (the Cup's
  gate); the two time boundaries stay independent.
- The previously-open leak on `/bets/[id]` is closed by keeping it owner-only:
  peers have no path to it.
- Reversing this (folding peer viewing back into `/bets/[id]`) means breaking or
  redirecting the `/communities/[slug]/bets/[betId]` URLs, which may be linked
  or bookmarked.
