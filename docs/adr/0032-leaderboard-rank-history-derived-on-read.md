# Leaderboard Rank History Derived on Read

To keep the application highly competitive and social, we introduce **Rank History** — a line chart showing the progression of each closed **Bet**'s rank in a **Community**'s **Leaderboard** as matches finish. 

To implement the progression data feed, we chose an **on-the-fly, derived-on-read calculation** rather than persisting daily snapshots or match snapshots in the database. 

## Context and Rationale

We rejected persisting rank history snapshots in the database for the following reasons:
1. **Single Source of Truth:** The platform's core architecture dictates that the **Leaderboard**, **Result**, and **Score** are derived read models computed live from **LiveResults** and **Manual Tie-Breaks**. Storing snapshots would introduce a secondary state database.
2. **Resilience to Retrospective Edits:** If an Admin corrects a finished match's score or updates a group's **Manual Tie-Break** factor retroactively, a persisted history would need complex recalculation and database rewrite scripts. By deriving history on read, retrospective corrections naturally cascade through the timeline without state desynchronization.
3. **Low Computational Overhead:** Since a **Bet**'s prediction content is static (pre-computed upon close) and scoring only involves checking phase membership and champion/third-place matches, computing scores for all Bets across all finished matches takes less than 50ms in Node.js for standard community sizes (e.g., 50-100 members and up to 104 matches).

### Design and Scope Decisions

- **X-Axis Sequence:** Ordered by **Match Number** (`num`) starting from a baseline "Inicio" (Match 0) where all participants share rank 1 at 0 points. Using Match Number instead of finished timestamp ensures chronological stability even if matches finish out of order or are updated in bulk.
- **Y-Axis Metric:** Displays the **Rank / Position** in the Leaderboard, with the Y-axis inverted (rank 1 at the top, lower ranks at the bottom).
- **Provisional Live Point:** The final point of the chart is dynamic, representing the current provisional rank calculated from the live **Provisional Result** of any ongoing match. This segment will be styled distinctly (e.g., dashed or with a pulsing dot) to denote its temporary status.
- **Visual Clutter Management:** To avoid a "spaghetti chart" in large communities, the chart is restricted to the logged-in viewer's Bets plus the Top 10 Bets in that Community.
- **Library Selection:** We will use **Recharts** as the charting library. It is React-native, SVG-based, widely supported, and integrates seamlessly with modern styling and tailwind/custom CSS. The chart component will be a client component (`'use client'`) to safely interact with browser dimensions.

## Consequences

- Reconstructing the history requires running the tournament standing and bracket views $N$ times (where $N$ is the number of finished matches). The backend logic must be optimized to filter the `LiveResult` array and invoke the pure bracket builder in-memory, avoiding multiple database queries.
- No database migrations are required for this feature, ensuring smooth deployment.
- The UI chart component must handle SSR hydration safety by using a mount check or a loading skeleton before rendering the client-only charting library.
