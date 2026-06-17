# Arcade Ranking is global and per-User, deliberately separate from the Leaderboard

The platform's **Leaderboard** is strictly Community-scoped, one row per closed Bet, with no global cross-community ranking by deliberate design. The **Penguin Run** arcade feature needs the opposite: a single **global** ranking, one row per **User**, keyed on the User's all-time best game score. We model **Arcade Ranking** as its own concept in a separate `arcade` bounded context rather than extending the Leaderboard, because conflating the two would corrupt the betting domain's "no global ranking" boundary and tempt future code to let arcade scores influence bet standings.

## Consequences

- Arcade Ranking has **no effect on bet standings** and never breaks ties in the betting Leaderboard — they share only a UI page (sibling tabs), nothing in the model.
- A new `arcade` module owns its own aggregate (the Penguin Run) and read model; the `leaderboard`, `bet`, and `score` modules are untouched.
- Reversing this (e.g. merging the rankings) would mean schema and UI rework, hence recording the boundary now.
