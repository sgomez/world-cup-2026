# ADR 0021: Direct Bets Store Scoreable Content as Source of Truth

**Status:** Accepted
**Date:** 2026-06-12

## Context

An external community wants to participate on the platform, but they did not fill
their predictions the platform's way. Instead of predicting group finishing
orders and a third-place ranking and letting the bracket *derive* who reaches
each round, they filled the knockout rounds **directly** — Round of 32 through
the Final, plus the Final winner and the third-place winner.

Every existing **Bet** is what we now call a **Bracket Bet** (CONTEXT.md): it
stores only user intent — `groupPredictions` (group orders + thirds order) and a
sparse `knockoutWinners` map — and the set of teams reaching each round is a
*derived* read model, recomputed on every read via `createInitialState`
(ADR 0006). The **Score** and the **Bet Signature** (ADR 0007) are likewise
derived, never stored.

That model cannot represent the external predictions. The set of teams an
external bettor places in, say, the Round of 16 need **not be realizable by any
valid bracket** — they may advance two teams the real bracket would pit against
each other. So the picks cannot be round-tripped into `groupOrders` /
`knockoutWinners`. There is no bracket to derive from.

But scoring never needed the bracket. A Bet's **Score** depends only on its
**scoreable content** — the *sets* of teams reaching each round (R32, R16, QF,
SF, F) plus the predicted Champion and third-place winner (ADR 0007). The
external community gives us exactly that, directly.

## Decision

Introduce a second kind of Bet — the **Direct Bet** — whose **Direct Prediction**
records the scoreable content directly, as the source of truth, instead of
deriving it from a bracket.

- **Storage.** Add one nullable `directPredictions Json?` column to the `Bet`
  table (shape: `ScoreableContentArrays` — `R32`/`R16`/`QF`/`SF`/`F` arrays of
  team ids, plus `champion` and `thirdPlace`). Team ids are stored as the
  lowercase internal `team.id`, the same convention as `groupOrders`. The
  migration is additive and backward-compatible (ADR 0003); no backfill.
- **Kind is implicit.** No discriminator column. A Bet with `directPredictions`
  set is a Direct Bet; otherwise it is a Bracket Bet. The aggregate enforces the
  invariant `directPredictions` **XOR** `groupPredictions` — a Bet is exactly one
  kind.
- **Born closed.** A dedicated factory `Bet.createDirect(label, ownerId,
  directPredictions)` constructs the Bet already `closed`. Under relaxed validation rules (amended by sub-issue #227), it normalizes team IDs, dedupes them within each round (preserving order), validates that round sizes do not exceed their capacity (R32 ≤ 32, R16 ≤ 16, QF ≤ 8, SF ≤ 4, F ≤ 2), and ensures every listed team ID (including the optional Champion and third-place winner) is a known team. It drops the exact-size equality, round nesting checks, and champion/third-place winner cross-field placement checks to tolerate errored-but-coherent bets. Direct Bets never enter `draft` and are never edited; `updatePredictions`, `close` and `reopen` do not apply to them.
- **One branch point.** `bet.scoreableContent(): ScoreableContent` is the single
  place that knows the two kinds: it returns `toScoreableContent(directPredictions)`
  for a Direct Bet, and `extractScoreableContent(createInitialState(...))` for a
  Bracket Bet. Leaderboard scoring, the **Bet Signature**, and the score view all
  call it and stay kind-agnostic.
- **Score-only show-bet view.** The community show-bet route
  `/communities/[slug]/bets/[id]` renders the **Score tab only**, for *all* bets
  (ADR 0011's route, narrowed). A Direct Bet has no Groups or Knockout view to
  show; rendering only the Score keeps the surface uniform across both kinds. The
  owner's own `/bets/[id]` keeps all three tabs (Bracket Bets only ever reach it).

## Reconciliation with ADRs 0006 and 0007

ADR 0006 ("stores only user intent — never derived state") and ADR 0007
("Signature never persisted… derived data kept out of the DB") still hold **for
Bracket Bets**. For a Direct Bet the scoreable content is **not derived** — it is
the *primary input*, the user intent itself, because no bracket exists upstream
of it. Storing it is therefore consistent with "store intent, not derived state",
not a violation of it. The Bet Signature remains computed-on-read for both kinds
(never stored); a Direct Bet and a Bracket Bet with identical scoreable content
produce the **same** Signature, because the canonical format (ADR 0007) is fed
from `scoreableContent()` regardless of kind.

## Alternatives Considered

**Synthesize a bracket.** Reverse-engineer `groupOrders`/`knockoutWinners` that
reproduce the external round sets. Rejected — impossible in general: arbitrary
round membership is not bracket-representable.

**Separate `ExternalBet` table/aggregate.** Rejected — it would duplicate label,
status, community-membership, leaderboard and signature plumbing, and force every
read (Leaderboard, peer view) to union two sources, for what is the same scored
object.

**Explicit `kind` discriminator column.** Rejected — a second field that must be
kept consistent with which prediction columns are populated; the `directPredictions`
presence already discriminates unambiguously under the XOR invariant.

## Consequences

- The `Bet` table gains one nullable column and the aggregate gains a factory, a
  completeness rule, and the `scoreableContent()` branch point; the three existing
  scoring read-paths (leaderboard, signature, score view) route through it and
  need no per-kind branching of their own.
- Direct Bets appear on the **Leaderboard** and carry a **Bet Signature** exactly
  like Bracket Bets, with no special-casing in those modules.
- The community show-bet view stops exposing Bracket Bets' full group/bracket
  detail to peers — a deliberate UX narrowing, reversible only by re-adding the
  tabs.
- **Out of scope here** (a later stage): the importer that turns the external
  feed into Direct Bets, and the placeholder owner User and external Community +
  membership those bets attach to. This ADR prepares the platform's logic,
  storage, scoring and display to *hold* Direct Bets.
