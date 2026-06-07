# ADR 0006: Bet Prediction Data Split into Two JSON Columns

**Status:** Accepted  
**Date:** 2026-06-07

## Context

A `Bet` must persist a user's complete tournament prediction: group standings, third-place rankings, and all knockout-round winners. The in-memory `TournamentState` is a rich derived graph — R32 slots are computed from group orders, deeper rounds cascade from R32 winners — but most of that graph is fully deterministic once the inputs are known.

We needed to decide what to actually write to the database.

## Decision

Store predictions in two separate `Json` columns on the `Bet` table:

**`groupPredictions`** — the two inputs that drive the entire R32 bracket:
```ts
{
  groupOrders: Record<string, string[]>  // group letter → ordered team IDs
  thirdPlaceOrder: string[]              // 12 third-place slot IDs in user-ranked order
}
```

**`knockoutWinners`** — a flat, sparse map of user winner choices:
```ts
Record<string, string>  // matchId → winnerId
```

Match IDs follow `{ROUND}-{matchNumber}` format. Match numbers align with official FIFA match numbering (group stage = 1–72, knockout = 73+):

| Round | Match IDs |
|-------|-----------|
| R32   | R32-73 … R32-88 (16 matches) |
| R16   | R16-89 … R16-96 (8 matches) |
| QF    | QF-97 … QF-100 (4 matches) |
| SF    | SF-101, SF-102 (2 matches) |
| 3RD   | 3RD (1 match) |
| F     | F (1 match) |

Only matches where the user has picked a winner appear in the map. A complete, closeable bet has exactly 32 entries.

On load, `createInitialState` rehydrates the full `TournamentState` by recomputing R32 slots from `groupPredictions` and cascading `knockoutWinners` through the match progression graph.

## Alternatives Considered

**Single JSON column for the full `TournamentState`.** Store the entire in-memory object including all `KnockoutMatch` objects with `team1Id`, `team2Id`, `winnerId`, `loserId`. Rejected because the derived fields (team slots in each match) change whenever group orders change — storing them would require keeping the database in sync with computed state, creating a consistency risk.

**Relational rows per match prediction.** One row per knockout match winner. Normalized, queryable, but adds join complexity for a read-heavy pattern with no current query need for per-match filtering.

## Consequences

- Database stores only user intent (ordered groups, winner picks) — never derived state.
- All derived match slots are recomputed on read via `createInitialState` in `src/lib/prediction-state.ts`.
- Closing a bet requires `Object.keys(knockoutWinners).length === 32` — all 32 knockout matches must have a winner.
- `groupPredictions` and `knockoutWinners` are written together on every `updateBetPredictions` call; they are never written independently.
