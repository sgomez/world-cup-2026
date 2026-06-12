# ADR 0020: Provisional Scoring from Live Standings

**Status:** Accepted
**Date:** 2026-06-12

**Relates to / partly reverses:** ADR 0012, ADR 0015 (the "settled on completion, not mid-stage clinching" rule) and ADR 0013 (scoring is `Bet × Result`). Those decisions still govern the **bracket and calendar display**; this ADR carves out **scoring** to use a looser, projected answer key.

## Context

Points in this app are earned by **phase membership** only — which knockout round a team reaches (R32=3 … F=8, Champion=10, third-place=5). Group scorelines award nothing directly (ADR 0013, CONTEXT *Score*). Advancement into the bracket is **derived and "settled on completion"** (ADR 0015): a group's top two settle only when all six of its matches are `finished`; the eight best thirds settle only when all twelve groups finish; `live` never settles. ADR 0012/0015 deliberately rejected mid-stage mathematical clinching as combinatorial and error-prone, and chose to show **TBD** until a slot settles.

The consequence surfaced on the tournament's opening day: two finished matches, zero complete groups → the answer key (`extractScoreableContent(bracketView)`) is empty → **every Bet scores 0** and the **Leaderboard** is flat. This is correct under the settled rule but reads as broken to users, who expect their ranking to move as soon as football is played.

The user wants Scores and rankings to move **from the first whistle**, with an explicit warning that the numbers are provisional until results are final.

## Decision

Introduce a **Provisional Result** — a second on-read derivation of the answer key used **only for scoring** (`getActualScoreableContent`, which feeds both the **Leaderboard** and each Bet's **ScoreTab**). The bracket and calendar display are **unchanged**: they keep deriving occupants under the strict settled/`finishedOnly` rule and keep showing **TBD**. The two paths deliberately diverge — a team can score points while its bracket slot still reads TBD.

The Provisional Result **projects** advancement instead of waiting for settlement:

- **Group top two** — a group's *current* top two (from the live standings table, `live` + `finished` matches) are projected into the Round of 32 as soon as that group has played **at least one match**. A group with no started match projects no one (its slots stay TBD even for scoring).
- **Best thirds** — projected once **all twelve groups** have each played at least one match (you need twelve current thirds to rank the best eight and resolve `combinations.json`). Until then the eight third-place slots score nothing.
- **Knockout** — a `live` knockout match projects its **current on-pitch leader** into the next round; a mid-match draw projects no one. Finished knockout matches settle as before.

Everything settles to the exact result as matches finish. The **Cup** is untouched: it remains gated on **Competition End** (matches 103 and 104 `finished`) and is never awarded on provisional points. The **Bet Signature** is unaffected (it fingerprints the Bet, not the answer key), as is the pre-**Bet Deadline** secrecy/leak boundary (no real results exist before the deadline).

A **Provisional Warning** is shown on the Leaderboard (banner) and each ScoreTab (note) **whenever any match is `live`**.

## Considered Options

- **Settled-only everywhere (status quo).** Rejected: produces a flat, zero Leaderboard for days, which reads as a bug.
- **Provisional everywhere (bracket + calendar + scoring).** Rejected by the user: keep the public bracket trustworthy (TBD until settled) and confine the churn to the numbers. Cost: scoring and display can disagree (a team scores while shown TBD), accepted and documented.
- **Provisional thirds one group at a time.** Rejected: `combinations.json` is keyed on a full set of eight qualifying groups; a partial set has no valid key. Thirds therefore wait until all twelve groups have started.
- **Warning tied to "provisional ≠ settled" or to Competition End.** Rejected in favour of the simpler "any match is `live`" trigger. Accepted trade-off: between matchdays the Warning hides even though group points are still projected from partial data.

## Consequences

- A **new third derivation mode** is needed in `deriveResult`/`getAdvancement`: today's `finishedOnly:false` advances *all twelve* groups unconditionally (empty groups by stable order) and never projects thirds or live knockout leaders. The Provisional Result needs the per-group "≥1 match started" gate, the "all twelve started" thirds gate, and live-knockout-leader projection — none of which the existing flag provides.
- Leaderboard and ScoreTab move together (same Provisional Result), preserving ADR 0013's invariant that a Bet's own breakdown total equals its Leaderboard number.
- Scores can swing during a `live` match and re-order, then settle — intended, and the Provisional Warning sets the expectation.
- The bracket/calendar (Advanced/TBD) and the scoring projection can visibly disagree mid-stage; this is by design and recorded in CONTEXT *Advanced* / *Provisional Result*.
