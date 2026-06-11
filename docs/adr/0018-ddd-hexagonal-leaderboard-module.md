# ADR 0018: DDD Tactical Patterns + Hexagonal Vertical Slice for the Leaderboard Module

**Status:** Accepted
**Date:** 2026-06-11

## Context

The Leaderboard is a first-class domain concept in `CONTEXT.md`. However, its scoring, ranking, and deadline-visibility rules are currently implemented as procedural mapping, scoring, and ranking loops inside `src/app/[locale]/(authenticated)/leaderboard/page.tsx` and the helper library `src/lib/leaderboard.ts`. The UI layer is forced to orchestrate queries across multiple contexts (Prisma, BetRepository, TournamentRepository, LiveResultRepository) and perform complex domain calculations, making the system shallow and leaking invariants.

## Decision

Establish a `Leaderboard` bounded context under `src/modules/leaderboard/` to encapsulate leaderboard generation and scoring:

```
src/modules/leaderboard/
  domain/          leaderboard.ts  scoring-service.ts  errors.ts
  application/     get-leaderboard.ts
```

- **Aggregate.** `Leaderboard` is a read-model aggregate computed dynamically on read from a list of `Bet` aggregates, a tournament `Result`, and a `BettingWindow`.
- **Logic.** The aggregate encapsulates the scoring math (delegating to `src/lib/scoring.ts`), stable ranking (ordering by points desc, then by oldest creation date), and the pre-deadline secrecy rule (zeroing scores and hiding selections).
- **Application Service.** The `GetLeaderboard` service coordinates loading active bets for the user's communities, loading the tournament state and live results to derive the actual outcome, and constructing the `Leaderboard` aggregate.

## Alternatives Considered

- **Precompute or cache scores in the DB.** Rejected (as per ADR 0013): dynamic computation on read is low-cost at this scale and completely avoids synchronization/staleness issues.
- **Merge into the Bet or Community modules.** Rejected: the leaderboard is the intersection of Bets (predictions), Community (members), and Tournament (results). Merging it into any single one would introduce circular/unhealthy dependencies. It warrants its own neutral bounded context.

## Consequences

- The Next.js page components become thin renderers, calling a single high-leverage application service.
- Standings calculation, ranking, and secrecy rules are isolated from UI details and fully unit-testable.
- The scoring library (`src/lib/scoring.ts`) is cleanly integrated behind the leaderboard aggregate seam.
