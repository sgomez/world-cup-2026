# ADR 0016: Factor-Based Manual Tie-Breaks and Upcoming Match State

**Status:** Accepted
**Date:** 2026-06-11

**Supersedes (in part):**
- ADR 0015 — extended to support the `"upcoming"` state in `LiveResult` and refactored from a drag-and-drop ordered list manual tie-breaker to team-specific numeric factor values.

## Context

In ADR 0015, we established `LiveResults` as the single source of match facts and derived the tournament `Result` dynamically on read. For manual tie-breaks (e.g., when FIFA criteria points, goal difference, and goals scored leave teams tied), we implemented a drag-and-drop ordering system stored as a list of team IDs (`manualTieBreaks` and `thirdPlaceManualOrder`).

We encountered two limitations with this approach during live tournament testing:
1. **Match State Lifecycle:** A match that has not started originally had no database representation (absence of `LiveResult`). However, the Admin interface needs to transition matches cleanly between "not started/upcoming", "live", and "finished". Transitioning a finished match back to "upcoming" (not started) was not cleanly supported due to the lack of an explicit `upcoming` status and the bot-prevention "finished latch" which blocked any transitions out of `finished` back to `live`.
2. **Manual Tie-Breaks Usability:** Drag-and-drop ordering requires complex state management and only allowed ordering teams that the engine had *already* identified as tied. The administrator wants a simpler, more deterministic model: assign a numeric "tie-break factor" (e.g., Mexico = 3, Korea = 2, RSA = 1) to any team. If the automatic standings rules result in a tie, the team with the higher factor wins the tie. We also need separate tie-break values for group standings and the cross-group best third-place standings.

## Decision

We will refactor the Live Results Admin and Manual Tie-Breaks as follows:

### 1. Introduce `"upcoming"` state to `LiveResult`
- We expand the `LiveStatus` type to `"upcoming" | "live" | "finished"`.
- A match with `status: "upcoming"` is treated logically as "not started", rendering with no goals or scoreline in the standings/calendar.
- We bypass the "finished latch" (which blocks `finished` -> `live`) exclusively for Admin modifications. While the automated bot API remains restricted from downgrading finished matches, the Admin panel server actions can transition a match freely between any state (`upcoming` <-> `live` <-> `finished`), resetting scores to `0` and clearing penalties when downgraded to `upcoming`.

### 2. Shift to Factor-Based Manual Tie-Breaks
- We repurpose the existing `Json` columns in the `Tournament` singleton to avoid database migrations:
  - `Tournament.manualTieBreaks` stores `Record<string, Record<string, number>>` mapping `GroupLetter -> { [TeamId]: FactorNumber }`.
  - `Tournament.thirdPlaceManualOrder` stores `Record<string, number> | null` mapping `{ [TeamId]: FactorNumber }`.
- The sorting engine (`src/lib/standings/standings.ts`) uses a new factor-based criterion that:
  1. Reads the configured factor for each team in a tied cluster (defaulting to `0` if undefined/empty).
  2. Sorts the teams in descending order of their factors.
  3. Groups teams with identical factors into sub-clusters (preserving their ties so subsequent rules like `stable` can apply).

### 3. Live-Updating Admin Interface
- We replace the custom list-based `AdminMatchScoreEditor` and drag-and-drop `AdminTieBreakPanel` with:
  - **Calendar Results Editor:** A chronological calendar view of all 104 matches, allowing inline editing of scores, penalties (for knockout matches), and status.
  - **Group & Thirds Tie-Breaks Editor:** A grid view of all groups showing standings and a numeric input box for the tie-break factor next to each team, plus a similar section for the best third-place teams.
- To enforce "live update" without a global save button, status changes save instantly on change, while score, penalty, and factor updates save on focus loss (blur) or on Enter key press.

## Consequences

- The database schema is preserved without migrations.
- Standing calculations and tie-breaking remain correct by construction.
- The Admin interface offers high usability, real-time feedback, and immediate persistence.
- Any change to previous match results propagates forward, instantly updating team slot occupants for future knockout matches on the calendar.
