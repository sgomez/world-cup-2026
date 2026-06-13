# ADR 0024: Shared Tournament Reference Data as Neutral Flat Modules

**Status:** Accepted
**Date:** 2026-06-13

## Context

Four helpers lived under `src/lib/`, predating the move to DDD-hexagonal modules
(ADRs 0008, 0010, 0017, 0018):

- `teams.ts` — the team catalogue and group structure (`Team`, `GroupData`,
  `getGroups`, `getTeamById`, `getTeamByName`), derived from
  `data/worldcup.teams.*.json`.
- `matches.ts` — the fixture schedule (`Match`, `getAllMatches`,
  `getMatchByNum`, `getKickoffInstant`), derived from `data/worldcup.json`;
  the home of the **Match Number** and **Kickoff** terms.
- `bet-constants.ts` — `BET_DEADLINE` (**Bet Deadline**) and
  `MAX_BETS_PER_USER` (**Bet Limit**), both read from `process.env`.
- `communities.ts` — `buildInviteUrl`, formatting an **Invite Link** from a
  token and `NEXT_PUBLIC_APP_URL`.

`teams.ts` and `matches.ts` are *shared reference data*: `teams.ts` is imported
by `bracket` (a low-level leaf module), `bet`, `tournament`, and many
components; `matches.ts` is imported by both `live` (the poller reads
**Kickoff**) and `tournament` (`derive-result`). The obvious move — folding
them into the `tournament` module since they describe the tournament — would
force `bracket → tournament` and `live → tournament` import edges. That
reverses the existing direction: `tournament` already depends on `bracket`, and
`live` sits upstream of `tournament`'s derived **Result**.

## Decision

Treat the shared reference data as a **neutral shared kernel** and keep it out
of `tournament`:

- `src/modules/teams/` — flat module (single `index.ts` barrel) for the team
  catalogue and group structure.
- `src/modules/schedule/` — flat module for the fixture schedule, **Match
  Number**, and **Kickoff**.

Both follow the existing flat-module style of `bracket` and `score`. Any module
may depend on these without acquiring a dependency on `tournament`.

The two env-coupled helpers move by their true nature, not their domain flavour:

- `bet-constants.ts` → `src/config/bet.ts`. These are env-driven composition
  values, not domain. The `bet` domain stays env-pure: `BettingWindow` still
  takes an *injected* deadline; the container reads `src/config/bet.ts`.
- `communities.ts` → `src/modules/community/application/build-invite-url.ts`.
  The **Invite Link** is a Community concept, but URL formatting from
  `NEXT_PUBLIC_APP_URL` is a presentation concern, so it lands in the
  application layer rather than the domain.

## Alternatives Considered

- **Fold `teams` + `matches` into `tournament`.** Rejected: forces
  `bracket → tournament` and `live → tournament`, inverting the existing
  dependency direction. The reference data is upstream of every consumer and
  belongs in a neutral kernel, mirroring the reasoning that kept `leaderboard`
  its own context (ADR 0018).
- **A single `catalog` module holding both.** Rejected: teams and the fixture
  schedule have disjoint consumers and no shared logic; one barrel would couple
  them for no benefit.
- **Put `bet-constants` in the `bet` module.** Rejected: it would pull a
  `process.env` read into the module whose domain is deliberately env-pure.
  Composition-time config belongs at the app level.

## Consequences

- `src/lib/` sheds reference data and config; the modules own their language.
- Dependency direction stays acyclic: `teams`/`schedule` are leaves that
  `bracket`, `bet`, `tournament`, `live`, and components may freely import.
- ~40 import sites repoint (`@/lib/teams` → `@/modules/teams`,
  `@/lib/matches` → `@/modules/schedule`, `@/lib/bet-constants` →
  `@/config/bet`), including `vi.mock` targets in the bet/community tests.
