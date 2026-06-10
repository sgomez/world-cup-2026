# ADR 0013: Live Scoring and Derived Competition End

**Status:** Accepted (extended by ADR 0015)
**Date:** 2026-06-09

> **Extended by [ADR 0015](./0015-liveresult-feed-and-live-derived-group-order.md).** This ADR's decisions are intact: scoring is `Bet × Result`, live, derived, never stored; Competition End is derived from the Result. 0015 only changes what is *underneath*: the `Result` scored against is itself now derived from `LiveResults`, so scoring derives transitively, and Competition End is reached automatically when the third-place (103) and Final (104) matches are `finished`. `getActualScoreableContent()` / `extractScoreableContent` are unchanged.

## Context

ADR 0012 built the `Tournament` aggregate (the official `Result` and the Advancement Gate) but explicitly deferred scoring: `scoreBet()` stayed stubbed to `0` (`src/lib/leaderboard.ts`) and `TOURNAMENT_ENDED` stayed a hand-flipped boolean (`src/lib/bet-constants.ts`). ADR 0012 named the follow-up: "Wiring real scoring (Bet ⨯ Result) and possibly moving Competition End onto the Tournament are a later slice. Dependency runs one way: leaderboard → tournament." This is that slice.

The pieces already exist but are disconnected:

- The **scoring rules** (R32=3, R16=4, QF=5, SF=6, F=8 per team in round; Champion=10; third-place winner=5) live hardcoded in the `ScoreTab` client component (`src/components/score-tab.tsx`), fed `EMPTY_ACTUAL_RESULTS`.
- `scoreBet()` is a separate stub returning `0`.
- The answer key now exists: `Tournament.result` + `Tournament.bracketView()`.

A Bet is scored by **phase membership, not match correctness** (CONTEXT.md *Score*, ADR 0007): a Bet earns a round's points for every team it placed in that round that actually reached it, regardless of opponent or slot. This is exactly the scoreable content the Bet Signature already fingerprints (ADR 0007).

## Decision

**Live, derived, never stored.** A Bet's Score and the Leaderboard are computed on read from the Bet and the current `Result`, never persisted. As the Admin enters results match by match, scores climb and Leaderboard positions reorder. This follows the existing derived-data discipline (ADR 0006: the DB holds only user intent; ADR 0007: the Signature is computed on read, never stored). Cost is negligible at this scale (a handful of users and bets).

**One shared extractor.** A single pure helper `extractScoreableContent(knockoutMatches)` returns `{ R32, R16, QF, SF, F: Set<string>, champion, thirdPlace: string | null }` from any knockout-match map. It becomes the single source of truth for *what is scoreable*:

- `computeBetSignature` is refactored to hash the output of this helper. The canonical-string step is unchanged, so **signature values are byte-identical — no published commitment is invalidated.**
- A Bet's scoreable content = `extractScoreableContent(bet bracket)`.
- The answer key = `extractScoreableContent(Tournament.bracketView())`.

This structurally enforces ADR 0007's warning ("any future scoring change that alters which data affects the score must be reconciled with [the signature] format"): the rounds that score and the rounds that sign are now the same code, not two lists that can drift.

**Scoring placement.** The scoring module lives in `src/lib/scoring.ts` (the round/title point values, the set-intersection math, `scoreBet`). Scoring is the *join* of two bounded contexts — Bet (prediction) × Tournament (result) — and belongs to neither. Placing it in `tournament/application` would force a tournament → bet dependency; placing it in `bet/` reverses ADR 0012's stated one-way dependency. `src/lib/` already holds this cross-cutting derived layer (`bet-signature.ts`, `leaderboard.ts`, `prediction-state.ts`, `bracket-core.ts`). The point values are a tunable policy, not domain language, so they stay out of CONTEXT.md.

**The answer key is derived server-side and shared.** Only the server holds the `Tournament` aggregate. A single server helper `getActualScoreableContent()` loads the `Tournament` (`?? Tournament.createDefault()` for the empty case) and returns the answer key. Used by the leaderboard page (server-side scoring) and the two pages rendering `BetPrediction`/`ScoreTab` (passed down as a prop). The answer key crosses the RSC boundary as **arrays** (Sets do not round-trip cleanly); `ScoreTab` rebuilds Sets internally. `BetPrediction` gains one pass-through `actualResults` prop, defaulted to empty so existing call-sites are untouched.

**Competition End is derived from the Result, not a stored flag.** `TOURNAMENT_ENDED` is deleted. Competition End is reached the moment **both the Final winner and the third-place winner are recorded** in the `Result` — i.e. nothing left to enter can still move a Score. The Final winner implies the entire knockout tree above it is settled; the third-place winner is required because it too awards points. Exposed as `Tournament.isCompetitionEnded()`; the Leaderboard page reads it to gate the **Cup**. Scores go live independently of this gate — Competition End only withholds the Cup, never the running scores.

**Leaderboard leak boundary.** A Bet's raw scoreable content *is* its prediction, which the Bet Deadline keeps secret from peers (only the opaque Signature is shown pre-deadline, ADR 0007). Therefore: before the Bet Deadline the Leaderboard reports every score as `0` and never ships peer scoreable content to the client. This is safe because no real results exist before the deadline anyway (the first match is after it), so real scores are inherently `0`. After the deadline, peers' closed-bet predictions are already public (CONTEXT.md *Community Member*), so nothing new leaks. Leaderboard points are always server-computed numbers; raw scoreable sets never join a client-facing shape. A viewer's own `ScoreTab` is exempt — it is their own data.

## Alternatives Considered

**Precompute / cache scores on each Result edit.** Rejected: it would be the first stored derived state in the codebase, against ADR 0006, and adds a cache-invalidation fan-out on every (deadline-free, mid-tournament) Result edit. Live computation has zero staleness surface and is cheap at this scale. Precompute only earns its keep at a scale this project does not have.

**Keep separate scoreable extractors for signature and scoring.** Rejected: two lists of "which rounds matter" that must stay identical (ADR 0007 §Consequences) but are free to drift. One extractor makes drift impossible.

**Place scoring in the bet or tournament module.** Rejected: scoring depends on both aggregates; either placement creates a cross-context dependency, and the tournament direction reverses ADR 0012. `src/lib/` is the established neutral join layer.

**Competition End as an admin toggle or env flag.** Rejected: a toggle is one more piece of admin state to forget, and a hardcoded/env flag needs a redeploy to flip at the single climactic moment of the app. The Result already contains the exact signal ("both terminal winners recorded"); deriving it removes a moving part entirely. The trade-off accepted: the instant the Admin records the last of the Final and third-place winners, the Cup is awarded automatically — which is the desired behaviour.

**Zero scores on the Leaderboard until Competition End (only the Cup goes live).** Rejected: the `ScoreTab` UI already promises a running total, and a flat-zero Leaderboard while a Bet's own ScoreTab shows a non-zero tally is incoherent. Running scores with a Cup gate keeps the suspense on *who wins* without freezing the scores. (CONTEXT.md *Leaderboard* updated accordingly.)

## Consequences

- The Bet's `ScoreTab` breakdown total and its Leaderboard number are guaranteed identical: both call the same pure scoring module against the same answer key.
- The signature and the scorer can never disagree about what is scoreable — they share one extractor. Any future change to scoreable content is a single edit that moves both, and (per ADR 0007) is an effectively irreversible format change once commitments are published.
- An Admin editing the deadline-free `Result` after the tournament starts moves real points and can flip Competition End on or off (e.g. correcting a mistakenly entered Final winner un-ends the competition and retracts the Cup). Accepted: it represents reality being corrected, consistent with ADR 0012.
- `TOURNAMENT_ENDED` is removed; the Cup gate now has a real source.
- The Leaderboard's pre-deadline secrecy is structural (no scoreable content shipped) rather than incidental.
