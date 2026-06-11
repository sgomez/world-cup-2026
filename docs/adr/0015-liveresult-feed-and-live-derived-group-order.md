# ADR 0015: LiveResults as the Single Source of Match Facts; the Result Becomes Derived

**Status:** Superseded in part by ADR 0016
**Date:** 2026-06-10

**Supersedes (in part):**
- ADR 0012 — its core storage and workflow decisions no longer hold: "Standings are entered as orders, never as scorelines", "Store per-match scorelines — Rejected", "Auto-compute mathematical classification — Rejected", and the manual **Advancement Gate**. See "What 0012 got right and what changed" below.
- ADR 0013 — unaffected in spirit (scoring is still `Bet × Result`, live, derived, never stored) but extended: the `Result` it scores against is **itself** now derived from LiveResults, so scoring derives transitively. `getActualScoreableContent()` and `extractScoreableContent` are untouched — they still read the same `Result`/`bracketView()` shape.

## Context

ADR 0012 built the `Tournament` aggregate with the `Result` (answer key) entered **by hand** as orders + third-place ranking + knockout winners, and an explicit manual **Advancement Gate**. It deliberately stored *no* per-match scorelines and *refused* to derive order from scores, on the grounds that encoding all FIFA tie-break rules and proving mathematical qualification mid-stage is hard and error-prone.

A new requirement changed the calculus: we want **live tournament data** — calendar and standings updating as matches play, fed by an external bot. That forces a per-match scoreline store to exist regardless. Once scorelines exist for *every* match, the hand-entered `Result` becomes **duplicated data**: the group orders, thirds ranking, advancement, and knockout winners are all recoverable from the scorelines. The tournament had not yet started (no real data), so the model could be unified cleanly rather than run two parallel stores.

The objection in 0012 survives in exactly one place: a scoreline **cannot** express FIFA's deep tie-breakers (fair-play conduct, drawing of lots). That irreducible remainder is the only thing that must stay manual.

## Decision

**`LiveResults` are the single source of match facts; the `Result` is a derived read model.** Nothing of the answer key is stored except a sparse manual-tie-break exception map.

### The `LiveResult` store (`src/modules/live/`)

A new bounded context (hexagonal vertical slice, like `bet`/`community`/`tournament`, ADR 0008) owns the **`LiveResult`** aggregate — one per match, keyed by **Match Number**: `{ status: 'live' | 'finished', goals1, goals2, penalties1?, penalties2? }`. No row = not started. Penalties are knockout-only.

**Match numbering.** Every match in `data/worldcup.json` gets a stable `num`: 1–72 for the group stage in official FIFA chronological order (1 = opener), the pre-existing knockout numbering 73–102, and `103` (third-place) / `104` (Final), which previously had none. Numbers come from the official FIFA match list, not derived by sorting (simultaneous kickoffs are not separable by date+time alone).

**Two writers, one command.** The aggregate is mutated through a single reconcile-to-target command with two adapters:
- the **bot** — `PUT`/`PATCH /api/live/matches/[num]`, `Authorization: Bearer` constant-time-compared to env `LIVE_FEED_TOKEN`, **fail-closed** (unset env ⇒ `503`; bad token ⇒ `401`);
- the **Admin** — a session-authed server action in the admin panel, the fallback to enter scores when the bot is down or to correct a wrong one.

`PUT` = full snapshot (creates/replaces). `PATCH` = partial merge onto an existing row (`404` if none). Conflicts (bot wrong *and* still writing over an admin correction) are **last-write-wins**; a per-match bot-lock is a deferred YAGNI fix. **Finished latch:** once `finished`, a later `live` snapshot is ignored (no un-finishing), but `finished`→`finished` is accepted so a final score can be corrected.

**Snapshot feed, honest events.** The API takes **full-state snapshots** (idempotent, self-healing against the bot's dropped messages), not increments. The aggregate diffs current→target and emits domain events true to what is observed — state transitions, not fictional per-goal facts:

| Event | Fires when | Payload |
|---|---|---|
| `MatchStarted` | no row → `live` | `num`, `group?` |
| `MatchScoreChanged` | goals differ while live | `num`, `group?`, `goals1`, `goals2` |
| `MatchPenaltiesChanged` | penalty pair differs (knockout) | `num`, `pen1`, `pen2` |
| `MatchFinished` | `live` → `finished` | `num`, `group?`, final score, `pen?` |

This is the **first domain-event infrastructure in the codebase**: aggregates record events, the application layer dispatches them **synchronously, in-process, after persistence** — no outbox/queue/broker, justified by scale (a handful of users, a few ticks per hour). A future notification bot or "GOAL!" animation subscribes to these and derives its own deltas.

### The derived `Result`

The `Result` is **computed on read** from LiveResults via the existing bracket engine plus a new standings engine. Stored persistence drops `groupOrders`, `thirdPlaceOrder`, `knockoutWinners`, and the `advancement` set; what remains is the **Manual Tie-Break** map.

- **Knockout winners** — derived from `finished` knockout scorelines (goals, then penalties). Fully automatic; no manual entry.
- **Group orders** — derived by the standings engine: a `live` LiveResult re-derives its group provisionally (standings table moves during a match); only `finished` results feed advancement.
- **Third-place ranking** — the twelve thirds ranked by points → GD → goals across groups; top eight advance; slots assigned via `data/worldcup.combinations.json`.
- **Advancement** — a **derived predicate**, not a toggle (the manual Gate is gone): a group's top two settle when its six matches are `finished`; the eight thirds settle when all twelve groups are `finished`. A `live` match never settles a slot. Until settled → TBD. This is "settled on completion," **not** mid-stage combinatorial clinching (which 0012 rightly called error-prone, and which we decline to attempt).

### The tie-break engine (`src/lib/standings/`, pure, no IO)

The neutral join layer (ADR 0013's `scoring.ts` rationale). `computeGroupStanding(teams, matches, criteria[])` sorts by **points** (always first), then resolves each tied cluster through an **ordered chain of refinement criteria**:

```ts
type TieBreakContext = { cluster: TeamId[]; matches: GroupMatch[] /* extensible: cards, … */ };
type TieBreakCriterion = (ctx: TieBreakContext) => TeamId[][]; // ordered sub-clusters; size ≥2 = still tied, deferred to the next criterion
```

A refinement (returns ordered sub-partitions) is used over a `(a,b)=>number` comparator because only it expresses "separate these, defer those." Default chain:

```
points → h2h points → h2h goal-diff → h2h goals → MANUAL → stable
```

**The Manual Tie-Break is the *terminal criterion*** — an Admin-dragged ordered team-id list, consulted **only** for a cluster the earlier rules left tied. Because it runs last it can **never** override points or head-to-head. It is stored **sparsely** (only for a group, or the thirds ranking, with a real unresolved tie). In the admin UI only the tied cluster is draggable; teams the rules already separated are pinned — so a drag can never appear to "snap back." Adding a future automatic rule (overall GD, fair-play) = insert another criterion *before* MANUAL and, if it needs new data, extend `TieBreakContext`. Thirds use the identical chain across groups.

### UI and delivery

- **Standings** is a dumb renderer of the derived group order (no sort of its own). A team in a `live` match shows a flashing marker right of its name (group tab), with a legend atop the tab. The knockout tab is the default iff all 32 R32 slots are settled.
- **Calendar** is a server wrapper merging static fixtures (`worldcup.json`) + LiveResults (scoreline + `live`/`finished` by `num`) + `bracketView()` (resolves `2A`/`W74` knockout labels to real teams as they settle, else TBD) — one consolidation point, the existing bracket engine, no second resolver.
- **Live delivery:** client `router.refresh()` on a ~30s visible-tab interval. Server components read Prisma directly (no `use cache`), so refresh yields fresh data with no tag plumbing. No SSE/WebSocket — disproportionate to the feed frequency.

## What 0012 got right and what changed

- **Right, kept:** the `Result` mirrors a Bet's shape so bracket-derivation and scoring code serve double duty; the `Tournament` aggregate; one-way dependency away from `bet`. The new `live → tournament` dependency parallels the existing `leaderboard → tournament`.
- **Changed:** scorelines now exist and are the source; group order and advancement are now *derived*, not hand-entered; the manual Advancement Gate is replaced by derived-on-completion advancement. 0012's "encode all tie-break rules" worry is answered by encoding the expressible ones and confining the inexpressible tail (fair-play, lots) to the Manual Tie-Break.

## Alternatives Considered

- **Keep 0012's hand-entered `Result` alongside LiveResults.** Rejected: once every match has a scoreline, the hand-entered orders/winners/advancement are duplicated data that can drift from the scorelines. Deriving removes the second store and the drift.
- **Derive *everything*, no manual lever.** Rejected: fair-play and drawing-of-lots are not in a scoreline. A sparse terminal-criterion override is the irreducible remainder.
- **Manual override as a stored full `Result` (today's model) or a numeric "tie factor."** Rejected: a full stored order can contradict points after a score correction; a numeric factor is an error-prone encoding of an order. The terminal-criterion list runs after points/h2h, so it is correct by construction, and survives corrections (a tie that dissolves simply never consults it).
- **Mid-stage mathematical clinching for advancement.** Rejected (as in 0012): combinatorial, error-prone; "settled on group completion" is deterministic and sufficient.
- **Incremental goal commands (faithful `GoalScored`).** Rejected: a dropped message permanently corrupts the score. Snapshots are idempotent; the honest events lose only per-goal granularity we never store.
- **Feed-only LiveResults (no admin writer).** Rejected: with the `Result` derived from LiveResults, a bot outage would freeze the entire answer key. An admin writer through the same command is the fallback.
- **SSE/WebSocket push; folding `LiveResult` into `tournament`.** Rejected: push infra is disproportionate; the live feed has a distinct lifecycle and writer/auth model that earns its own context.

## Consequences

- The codebase gains its first per-match scoreline store and its first domain-event mechanism, confined to the `live` slice and its derivation into `tournament`.
- The `Tournament` row stops storing orders/winners/advancement; it stores only the sparse Manual Tie-Break map. A migration drops those columns (ADR 0003: this is pre-launch, no real data to preserve).
- Scoring (ADR 0013) is unchanged in code but now derives transitively from LiveResults; **Competition End** (both terminal winners recorded) is reached automatically when matches 103 and 104 are `finished`.
- The admin/result page flips from data-entry to **exception review**: it shows the derived state and lets the Admin order only genuinely-tied clusters and enter/correct scores when the bot fails.
- A new production secret `LIVE_FEED_TOKEN` is required; absent it the live API is disabled, not open.
