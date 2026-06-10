# ADR 0012: Tournament Result Aggregate and the Advancement Gate

**Status:** Superseded in part by ADR 0015
**Date:** 2026-06-08

> **Superseded by [ADR 0015](./0015-liveresult-feed-and-live-derived-group-order.md).** The `Tournament` aggregate and the "Result mirrors a Bet's shape" decision still stand. But the `Result` is no longer hand-entered or stored: group orders, third-place ranking, knockout winners, and advancement are now **derived from per-match scorelines** (`LiveResults`). This reverses three decisions below — "Standings are entered as orders, never as scorelines", "Store per-match scorelines — Rejected", and "Auto-compute mathematical classification — Rejected" — and replaces the manual **Advancement Gate** with derived-on-completion advancement. Read this ADR for the aggregate's origin; read 0015 for the current model.

## Context

The platform has no record of what actually happened in the tournament. `scoreBet()` is stubbed to `0` (`src/lib/leaderboard.ts`) and `TOURNAMENT_ENDED` is a hand-flipped boolean (`src/lib/bet-constants.ts`). To compute points, an Admin needs a way to enter official results — the *answer key* every Bet is scored against (CONTEXT.md *Leaderboard*: "computed from the Bets and the actual results").

Two things make this more than a CRUD form:

1. **A Bet and the actual outcome are the same shape.** A Bet already stores group orders, a third-place order, and knockout winners (`src/lib/prediction-state.ts`, ADR 0006). The official outcome is structurally identical — it is a prediction that happens to be true.

2. **The group→knockout boundary is not atomic in real life.** Group standings settle progressively over days. A team is shown in the knockout bracket only once its qualification is mathematically certain; before that the slot is genuinely unknown. The Round-of-32 bracket reference for a team depends on its group *and* final position (`1A` and `2A` go to different slots), and each third-place slot depends on the *set* of eight qualifying thirds, resolved via `data/worldcup.combinations.json`. So "who is in slot X" cannot be safely shown the moment a single group result lands.

## Decision

Introduce a new bounded context, `src/modules/tournament/`, as a hexagonal vertical slice (same shape as the `bet` module, ADR 0008). It owns one aggregate.

**Aggregate.** `Tournament` is the aggregate root — a tournament-wide **singleton** (exactly one row). It holds the `Result` (the official outcome) plus the **Advancement** state. The `Result` mirrors the Bet `TournamentState`: actual group orders, actual third-place order, actual knockout winners. Reusing that structure means the existing prediction editor and the existing bracket-derivation logic (combinations table, match progression) are reused verbatim — no second bracket engine.

**Standings are entered as orders, never as scorelines.** The Admin records the final finishing order of each group directly. The system does *not* derive order from match scores: FIFA group tie-break rules are numerous and the Admin applies them by judgement offline. This keeps the `Result` structurally identical to a Bet and avoids a parallel match-score data model nothing else consumes.

**The Advancement Gate.** A single Admin step at the group→knockout boundary lists all 32 Round-of-32 slots (12 winners, 12 runners-up, 8 best thirds), each pre-filled with the team derived from the current `Result` standings. The Admin marks each slot **Advanced** — the same interaction as choosing a knockout match winner. Downstream the bracket shows the team only for Advanced slots; unmarked slots show **TBD**. The Gate is **uniform** across all 32 slots: the third-place coupling lives entirely in the *derivation* of each slot's candidate team (already solved code), not in the confirmation. By discipline the Admin won't mark third slots until the group phase is complete, but the mechanism is one toggle per slot.

The Gate exists **only** at this boundary. Within the knockout phase (R16→Final) there is no mathematical ambiguity — a played match has a definite winner — so later-round slots are filled by recording the winner directly, showing TBD until then.

**Edit cascade.** Editing the `Result` reuses and extends the Bet prediction's cascade-clear (CONTEXT.md *Knockout Prediction*): changing a group or third-place order clears invalidated knockout winners, and is extended to clear the `Advanced` flag of any R32 slot whose occupant changed. This is a safety net — progressive entry means group standings are long-settled before knockout starts — not a hot path.

**Persistence.** Single-row table with the ADR-0006 two-`Json`-column shape (result + advancement state), behind a `TournamentRepository` port with a Prisma and an in-memory adapter. Created lazily/empty; no seed migration with fake data.

**Authorization.** `admin` and `super_admin` only, enforced in the application layer (as in ADR 0008). The `Result` has **no Bet Deadline** — it is an operational tool edited over the weeks matches are played.

**Scope boundary.** This slice builds the Tournament aggregate, the Admin entry UI, and the Advancement Gate / TBD display. It does **not** touch scoring: `scoreBet()` stays stubbed and the Leaderboard stays derived + provisional (CONTEXT.md). Wiring real scoring (Bet ⨯ Result) and possibly moving `Competition End` onto the `Tournament` are a later slice. Dependency runs one way: leaderboard → tournament.

## Alternatives Considered

**Generic key-value `Settings` table.** The original framing ("a settings table or similar … to store some state of the games for future uses"). Rejected: the outcome has real structure already modelled as a Bet; a blob invites reinventing validation and ignores ADR 0006. Speculative "future game state" storage dropped as YAGNI.

**Fold the Result into the `bet` module.** Rejected: the outcome is a distinct aggregate with a different lifecycle (one admin-written singleton, no deadline) and a different invariant (the Advancement Gate). Folding it would muddy the `bet` module's language.

**Auto-compute mathematical classification** instead of a manual gate. Rejected: correctly proving a team is mathematically through — across three remaining matchdays *and* the cross-group best-thirds ranking — is hard and error-prone, and the Admin holds the authoritative knowledge anyway. A manual confirm is simpler and trustworthy.

**Store per-match scorelines.** Rejected: nothing in scoring or display needs them; only round-reach matters (CONTEXT.md *Bet Signature*). Deriving order from scores would require encoding all tie-break rules.

**Two different gate mechanisms** (per-team for winners, set-pick for thirds). Rejected as the user noted: a uniform per-slot toggle is simpler, and the third-place coupling is already handled by the shared derivation.

## Consequences

- The prediction editor and bracket-derivation logic serve double duty (predictions and official results); any divergence in their structure would break both, which is the intended forcing function for keeping them one model.
- The `Advanced` flag is display-gating state today; when scoring is wired it becomes the natural signal for "officially reached Round of 32." That coupling is deferred, not designed away.
- `Tournament` is the third aggregate to adopt the ADR-0008 vertical-slice shape, after `bet` and `community`.
- The Result is editable with no deadline, so an Admin edit after scoring goes live will move real points — accepted: it represents reality being corrected.
