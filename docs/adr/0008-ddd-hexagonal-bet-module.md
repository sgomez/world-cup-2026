# ADR 0008: DDD Tactical Patterns + Hexagonal Vertical Slice for the Bet Module

**Status:** Accepted
**Date:** 2026-06-08

## Context

Bet write logic lives in anemic server actions (`src/app/actions/bets.ts`). Each of the seven actions re-implements the same preamble — resolve session, fetch the bet, check ownership, check the Bet Deadline, check Bet Status — and calls Prisma directly.

The deadline check alone is spelled four different ways across the actions, and `updateBetPredictions` omits it entirely: predictions can currently be edited after the Bet Deadline, violating the deadline invariant (CONTEXT.md, ADR 0001). The rule has no single home, so a caller silently skipping it produced a live bug.

The (future) Leaderboard and the existing Bet Signature both derive from the same Bet state, so a testable, reusable Bet model — not just a deduplicated guard — is the deeper need.

## Decision

Adopt DDD tactical patterns behind a hexagonal seam, organised as a **vertical slice** at `src/modules/bet/`:

```
src/modules/bet/
  domain/          bet.ts  betting-window.ts  bet-repository.ts (port)  errors.ts
  application/     close-bet.ts  reopen-bet.ts  rename-bet.ts
                   update-predictions.ts  create-bet.ts  copy-bet.ts  remove-bet.ts
  infrastructure/  prisma-bet-repository.ts  in-memory-bet-repository.ts
src/app/actions/bets.ts   # Next.js driving adapter (unchanged location)
```

**Aggregate.** `Bet` is the aggregate root and the only entity (identity = `id`). Its Value Objects are `BetLabel` (≤200 chars, non-empty), `GroupPrediction`, `KnockoutPrediction`, `BetStatus`, and the derived `BetSignature`. Knockout winners remain a sparse map VO, not per-match entities (consistent with ADR 0006). The aggregate references its owner by `userId` only — it never holds a `User`.

**Betting Window.** The "no writes after the Bet Deadline" rule is modelled as a `BettingWindow` policy (CONTEXT.md term), injected into every mutating method (`bet.rename`, `bet.close`, `bet.reopen`, `bet.updatePredictions`, and the `Bet.create` / `Bet.copyFrom` factories). Because no mutating path exists that does not take and consult the window, the missing-deadline bug becomes impossible by construction. Time is passed in as `now: Date`, keeping the aggregate pure.

**Persistence port.** A `BetRepository` port (`findById`, `listByOwner`, `countByOwner`, `save`, `delete`) sits at the seam. `PrismaBetRepository` is the single place that knows the ADR-0006 two-column `Json` shape and runs `createInitialState` rehydration. `InMemoryBetRepository` is the second adapter, used by tests — the two adapters make the seam real and let the aggregate and application services be tested with no database.

**Invariant placement.** Single-Bet invariants (label validity, status transitions, completeness of 32 winners, the window) live in the aggregate. The **Bet Limit** is a cross-aggregate rule (it spans the user's whole Bet collection) and is enforced in the application service via `repo.countByOwner`, not in the aggregate.

**Authorization** is an application concern, not a domain invariant. The application service loads the Bet, then checks `bet.isOwnedBy(userId)` (a pure query), preserving the existing not-found vs not-authorized distinction. The Next.js server action resolves the session and passes `userId` inward; the domain and application layers never import `next/headers`.

Errors flow as `Result` / `ResultAsync` values — see ADR 0009.

The Bet module is the **pilot**; Community and User migrate to the same vertical-slice shape later.

## Alternatives Considered

**Keep anemic actions, extract a shared guard function.** A single `authorizeBetWrite` helper would dedupe the preamble but leaves behaviour as procedure, not a model. It does not give the Leaderboard a reusable scoring-capable Bet, and a guard is still skippable (the original bug). Rejected in favour of a model that owns its invariants.

**Horizontal layers** (`src/domain`, `src/application`, `src/infrastructure` as top-level trees). Classic hexagonal, but it scatters one aggregate across three top-level directories, weakening locality. Rejected for the vertical slice.

**Deadline as an application-layer check** rather than a `BettingWindow` injected into the aggregate. Rejected: it re-creates the "a caller can forget" surface that caused the bug.

**Bet Limit as a Bet invariant** (pass the current count into `Bet.create`). Rejected: it makes a single Bet depend on sibling state, breaking the aggregate boundary.

## Consequences

- The deadline rule has exactly one home; the `updateBetPredictions` post-deadline hole closes when this slice lands. A regression test asserting "predictions are rejected after the Bet Deadline" is part of the migration. **Until the slice ships, the bug remains open** — this was an accepted trade-off (no separate hotfix).
- The Bet module diverges structurally from the rest of the codebase until other aggregates follow; this ADR is the precedent that explains why.
- A row↔aggregate mapper is new code, but the ADR-0006 `Json` casts and rehydration that were duplicated across pages, the community action, and the signature module now live once, in `PrismaBetRepository`.
- The aggregate and application services are unit-testable against `InMemoryBetRepository` with no database.
- Migration is not a pre-deadline task (Bet Deadline 2026-06-11); it proceeds on its own track.
