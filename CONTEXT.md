# World Cup 2026 Sweepstake — Domain Glossary

## Terms

### User
A registered person on the platform. Identified by email. Authenticated via magic link. Every User has exactly one **Role**.

### Role
The access level of a User. One of three values:
- `user` — default. Can manage their own Bets and profile. Cannot see other users, except within shared Communities: may see the Member List at any time, and other Members' Bets after the Bet Deadline.
- `admin` — elevated. Can view all User profiles and Bets. Can grant or revoke the `admin` role on other Users. Cannot demote themselves.
- `super_admin` — permanent owner. Assigned to the first User who registers on the platform. Has all `admin` privileges. Cannot be demoted by anyone, including other `super_admin`s.

Only one `super_admin` exists at any time (the first registrant). All other elevated users hold `admin`.

### Bet
A named tournament prediction. A Bet is exactly one of two kinds — a **Bracket Bet** or a **Direct Bet** — distinguished by how its **scoreable content** (the teams reaching each round; see **Score**) is obtained. Each Bet has a **label**, a **status**, and system-managed timestamps (`createdAt`, `updatedAt`). A User may hold many Bets.

### Bracket Bet
The platform-native kind of Bet, created and edited by a User. Its prediction is entered as two parts and the teams reaching each round are *derived* by cascading them through the tournament bracket:
- **Group Prediction**: the user's predicted finishing order for each of the 12 groups, and their ranked ordering of the 12 third-place teams (determining which eight advance).
- **Knockout Prediction**: the user's selected winner for each match in the knockout bracket, stored as a sparse map of match ID to team ID. Winners propagate forward through the bracket and are cascade-cleared when a group prediction change invalidates them.

The label can be edited by the owner before the **Bet Deadline** while in `draft` status.

### Direct Bet
A Bet whose **scoreable content** is recorded **directly** as a **Direct Prediction** rather than derived from a bracket. It admits predictions made outside the platform's group→bracket flow — e.g. an external community that fills the Round of 32 through the Final straight away, plus the Final winner and third-place winner. A Direct Bet has **no** Group Prediction and **no** Knockout Prediction (and a Bracket Bet has no Direct Prediction — the two are mutually exclusive). It is **born `closed`** and immutable: it never passes through `draft` and is never edited on the platform. It is scored, carries a **Bet Signature**, and is ranked on the **Leaderboard** exactly like a Bracket Bet, because both reduce to the same scoreable content. Only its **Score** is viewable — the Groups and Knockout views depend on bracket structure a Direct Bet does not have.

### Direct Prediction
The stored prediction of a **Direct Bet**: for each knockout round (Round of 32, Round of 16, Quarter-finals, Semi-finals, Final) the exact set of teams the bettor places in that round, plus the optional predicted **Champion** and **third-place winner**. It is exactly the **scoreable content** a Bracket Bet would derive, but stated as the source of truth instead of computed. To be valid, team IDs within each round are normalized and deduped (with order otherwise preserved), each round must not exceed its maximum capacity (R32 ≤ 32, R16 ≤ 16, QF ≤ 8, SF ≤ 4, F ≤ 2), and every listed team ID (including the optional Champion and third-place winner, if present) must be a known team. Exact round-size equality, round nesting checks, and champion/third-place winner cross-field placement checks are not enforced.

### Bet Status
The user-intent state of a Bet. One of two values:
- `draft` — the Bet is being worked on. Predictions can be edited.
- `closed` — the User has explicitly locked the Bet. A Bet can only transition to `closed` once predictions for all matches (including all group standings and all 32 knockout matches) are complete. Once closed, predictions cannot be edited. Can be re-opened to `draft` before the Bet Deadline.

Status reflects user intent, not time. After the **Bet Deadline**, all write operations on any Bet are blocked regardless of status.

### Bet Deadline
The hard cut-off after which no Bet mutations are permitted: **2026-06-11 19:00 UTC**. Enforced on both client and server. Applies to: create, remove, copy, and edit (predictions + label).

### Betting Window
The open period during which Bets may be created and mutated. It is open until the **Bet Deadline** and closed from then on. While open, a write is permitted subject to the Bet's **Bet Status**; once closed, every Bet mutation is blocked regardless of status. The Window is a tournament-wide policy — the same for all Users and all Bets — not a property of any individual Bet.

### Bet Limit
Maximum number of Bets a User may hold at once. Configurable via environment variable (`MAX_BETS_PER_USER`), default **3**. Enforced on both client and server at create and copy time.

### Bet Copy
Creating a new Bet in `draft` status pre-populated with all predictions and the label of an existing Bet. The new Bet's label is prefixed with `"Copy of "`. If the resulting label exceeds 200 characters, it is truncated to fit.

### Bet Signature
A deterministic fingerprint of a **closed** Bet's *scoreable content* — the only data that affects its score. Two Bets with identical scoreable content always have identical Signatures, regardless of group-stage arrangement; conversely, any change that would change the score changes the Signature. The scoreable content is the set of teams reaching each knockout round (Round of 32, Round of 16, Quarter-finals, Semi-finals, Final), plus the predicted **Champion** and the predicted **third-place winner**. Group standings and individual match-ups are *not* part of it — only which teams reach each round. The Signature is derived data: it is always computed from the prediction and never stored. It is shown only for `closed` Bets (a draft has none). The Signature serves as a public commitment: it can be shown before the Bet Deadline (alongside the Bet's label and owner) without revealing the prediction, and verified against the revealed Bet afterwards.

### Profile
A User's public-facing identity: `name` and optional `image`. A User may edit their own Profile (name and image only; email is immutable). Admins and super_admins may view any User's Profile together with their Bet list.

### Community
A named group of Users created by one User (the **Community Owner**). Identified by a unique **slug** derived from its name at creation time. A User may belong to many Communities. Communities exist to let members compare predictions after the competition begins. Admins and super_admins may view all Communities (member lists and owner) via the admin panel.

### Community Owner
The User who created a Community. The Owner may invite new members (via an **Invite Link**), remove existing members, and delete the Community. Ownership is not transferable. The Owner cannot leave a Community — to exit, they must delete it.

### Community Member
A User who has joined a Community. Within a Community, Members can see the **Member List** at any time. Members can see each other's full Bet predictions only for **closed** Bets and only **after the Bet Deadline** (2026-06-11 19:00 UTC). Before the deadline, a Member's predictions are invisible to other Members; however, the label, owner, and **Bet Signature** of each *closed* Bet are visible to fellow Members before the deadline (a public commitment without revealing the prediction). Draft Bets are **always hidden** from other Members — before *and* after the deadline. A Bet that is still in `draft` when the deadline passes (see ADR 0001) stays frozen and never becomes visible to peers; only the owner ever sees it.

In an **Imported Community** (ADR 0022) a non-owner Member is **view-only**: they join via the **Invite Link** purely to read the **Leaderboard** and the **Import Owner**'s score-only Bets. Their own Bets **never participate** — only the Import Owner's Bets are ranked or peer-viewable in that Community. The peer Bet view returns nothing for any Bet not owned by the Import Owner.

### Member List
The list of Users belonging to a Community. Visible to all Members of that Community at any time.

### Invite Link
A URL containing a single-token secret generated by the Community Owner. Anyone with the link may join the Community. Only one active Invite Link exists per Community at a time. The Owner may regenerate the Invite Link at any time, which permanently invalidates the previous one.

### Score
A closed Bet's points measured against the **Result**. Points are earned by **phase membership, not match correctness**: a Bet earns a round's points for every team it placed in that round that *actually* reached that round — regardless of which opponent or bracket slot the Bet predicted. (Predicting "Japan reaches the Round of 16 against Spain" scores for Japan even if Japan actually got there against the USA.) On top of the per-round points, the predicted **Champion** (Final winner) and predicted **third-place winner** are single-team matches scored on identity. The scoreable content is exactly that of the **Bet Signature** — the set of teams reaching each knockout round, the Champion, and the third-place winner; group standings and individual match-ups score nothing directly. The Score is derived data: computed live from the Bet and the **Result** as actual outcomes are entered, never stored. The exact point value of each round/title is a tunable policy, not part of the domain language.

The answer key a Score is measured against is the **Provisional Result**, not the settled **Result**: scoring uses projected advancement so that points move from the first whistle rather than waiting for groups to complete (see **Provisional Result**).

### Leaderboard
A ranked list of **closed Bets** within a single Community, ordered by prediction accuracy **score** (descending). Scope is always one Community — there is no global, cross-community ranking. In a native Community every Member's closed Bets are ranked; in an **Imported Community** only the **Import Owner**'s Bets are ranked, since invited Members are view-only (see **Community Member**). One row is one closed Bet, not one User; a User who owns several closed Bets in the same Community appears once per Bet. Draft Bets never appear. Bets with equal scores **share** the same position (they are co-winners — see **Cup**). Scores are **live**: as results land match by match — and even mid-match — every Bet's score climbs and positions reorder accordingly, because scoring uses the **Provisional Result**. Positions are **provisional** until the **Competition End** — the ranking is real and updating, but the **Cup** is withheld until then. While any match is `live`, a **Provisional Warning** flags that the displayed points are projections that can still change. The Leaderboard is derived data: it is always computed from the Bets and the actual results, never stored (cf. **Bet Signature**).

### Cup
The mark of victory shown against every Bet sharing first position on a Community **Leaderboard**. Because positions are shared on ties, several Bets may hold the Cup at once. The Cup is awarded only once the **Competition End** has passed; before then, all positions display a plain number.

### Competition End
The point after which the tournament is over and final scores stand, gating the award of the **Cup**. Distinct from the **Bet Deadline** (which only closes Bet mutations). It is **derived from the Result, not a stored flag**: Competition End is reached once both the Final winner and the third-place winner are recorded in the **Result** — the moment nothing left to enter can still change a **Score**. (The Final winner implies the whole knockout tree above it is settled; the third-place winner is required because it too awards points.)

### Result
The official outcome of the competition — the *answer key* against which Bets are scored. It is **not stored**: it is a **derived read model** computed on read from the **LiveResults** (the actual match scorelines) plus a sparse **Manual Tie-Break** override. From the set of *finished* LiveResults the system derives everything the answer key needs: each group's finishing order, the ranking of the twelve third-placed teams (and therefore which eight advance and to which slots), which teams are **Advanced**, and the winner of every knockout match. It still mirrors the structure of a Bet's prediction (group order + third-place order + knockout winners), so the existing bracket-derivation and scoring code is reused unchanged — but those values are *produced* from scorelines, not entered by hand. Exactly one logical Result exists for the tournament; it carries no scorelines of its own and the only thing persisted on its behalf is the Manual Tie-Break exception map. It remains the single source of truth the **Leaderboard** scores against. Note: a group's order earns no points itself (see **Score**); it matters only for resolving which teams are **Advanced**.

### Manual Tie-Break
The Admin's last-resort numeric factor-based priority values to order teams that the automatic rules leave equal. The ranking engine sorts by points, then the three FIFA head-to-head criteria (points, goal difference, goals scored among the tied teams); any teams *still* tied are ordered by their Admin-assigned tie-break factor (highest factor first, defaulting to 0) — the **terminal tie-break criterion**. It exists per group, and separately for the cross-group ranking of third-placed teams (using two distinct sets of values: one for group standings, and one for the best thirds ranking). Because it runs **last**, it can never override points or head-to-head — it only decides what those rules could not. It is stored sparsely, and entries are updated live. It encodes the FIFA criteria that a scoreline cannot express (fair-play conduct, drawing of lots).

### Advanced
The state of a team confirmed to have reached the knockout stage (Round of 32). It is a **derived fact, not an Admin toggle**: a group's top two become Advanced the moment all six of that group's matches are `finished`; the eight best third-placed teams become Advanced once all twelve groups are `finished` (their slot assignment resolved via `data/worldcup.combinations.json`). Computed only from *finished* **LiveResults** — a `live` or `upcoming` match never settles advancement. Until a slot is settled it shows **TBD**. (English football term; the same concept the user calls "classified".) Advanced governs the **bracket and calendar display only**; **Score** is computed against a looser **Provisional Result** that projects occupants earlier, so a team can already be scoring while its bracket slot still shows TBD.

### TBD
The placeholder shown in any bracket slot whose occupant is not yet settled — a Round-of-32 winner/runner-up slot whose group has not finished, a Round-of-32 thirds slot before all twelve groups have finished, or a later-round slot whose feeding match is not yet `finished`.

### Provisional Result
A second derivation of the **Result** used **only for scoring** — never for the bracket or calendar display, which keep the stricter **Advanced**/**TBD** rule. Where **Advanced** waits for settlement, the Provisional Result *projects* advancement from the current state: a group's current top two are treated as having reached the Round of 32 once that group has played **at least one match** (`live` or `finished`); the eight best thirds are projected once **all twelve groups** have each played at least one match (twelve thirds are needed to rank the best eight); and a `live` knockout match projects its **current leader** into the next round (a mid-match draw projects no one). The consequence is that every **Score** and **Leaderboard** position moves from the first whistle, then settles as matches finish. Because projections shift, points carry a **Provisional Warning**. (This deliberately reverses, for scoring only, the "settled on completion" rule that still governs **Advanced** — see ADR 0020.)

### Provisional Warning
A notice shown on the **Leaderboard** and on each Bet's **ScoreTab** whenever **any match is `live`**, telling users the displayed **Scores** are projections from the **Provisional Result** that can still change. It is driven purely by the presence of a `live` match: between matchdays the Warning hides even though Scores remain projected from partial group data, and during the knockout it reappears whenever a match kicks off.

### LiveResult
The real-world score of a single match — the **single source of match facts** for the whole tournament, from which the entire **Result** is derived. A LiveResult records goals for each side, an optional penalty-shootout score (knockout only), the **Match Phase** and **Live Minute** observed at the last write, and a **status** of `upcoming` (not started), `live` (in play, scoreline may still change), or `finished` (full time). A match has *no* LiveResult or is set to `upcoming` when not started. Each match is keyed by its **Match Number**. LiveResults have **two writers** sharing one update command: the external bot (via the token-authenticated live API, which cannot revert `finished` matches to `live` due to a latch) and Admins (via the admin panel, who can transition matches freely between `upcoming`, `live`, and `finished`). The finishing order shown in the standings is re-derived from LiveResults (including `live` ones, so the table moves provisionally during a match); **Advanced** status and knockout winners use only `finished` LiveResults. LiveResults are surfaced to all users on the calendar and standings; a team in a `live` match is shown with a flashing live marker and its **Live Minute**.

### Live Feed Poller
The scheduled, in-process job that keeps **LiveResults** moving without human input — the automated embodiment of the "bot" writer named in **LiveResult**. On a fixed interval it performs one **Tick**: it promotes every match whose **Kickoff** has passed but is still not started (no LiveResult, or one in `upcoming`) to `live` at 0–0, then for each `live` match reads the **Live Feed** and applies the returned snapshot. It writes through the same single upsert command as the bot and the Admin — so last-write-wins holds and the **finished latch** still bars it from un-finishing a match. The Feed is the primary authority on when a match ends, with one bounded exception: a match still `live` **3 hours past Kickoff** is force-finished after a mandatory final poll, so every started match eventually settles (ADR 0028).

### Tick
One run of the **Live Feed Poller**: a single sweep that auto-starts due matches and applies a **Live Feed** snapshot to each `live` match. Ticks are idempotent — a match skipped or failed in one Tick self-heals on the next. A Tick's completion log reports `processed` as the count of **live matches** worked — those for which the Feed was actually queried (auto-started this Tick plus already `live`) — not every past-Kickoff match.

### Live Feed
The external source of in-play match facts the **Live Feed Poller** reads — one snapshot per `live` match: the current scoreline, the **Match Phase**, the **Live Minute**, the knockout penalty-shootout score, and whether the match has **finished**. It is the authority on *when* a match ends (the Poller decides this from a clock of its own only as the bounded 3-hour safety net; see **Live Feed Poller**). Two interchangeable providers sit behind one port, selected by configuration: a **mock** that echoes the stored scoreline and reports `finished` once a match's nominal duration has elapsed since **Kickoff**, and an **LLM-backed** provider that reads the open web via OpenAI web search and returns the snapshot as structured JSON (ADR 0027). A new provider drops in behind the same port without changing the Poller.

### Match Phase
Where a match currently stands in its own timeline, as reported by the **Live Feed** and recorded on the **LiveResult**: `not_started`, `first_half`, `second_half`, `extra_time`, `penalties`, or `finished` (plus a stoppage-time flag). It drives the **Live Minute** display and is the source from which `finished` is derived. It is a display fact only — it never feeds **Score**, **Advanced**, or the **Result**. A match auto-started to `live` at **Kickoff** that the Feed still reports as `not_started` stays `live` and shows `0'`.

### Live Minute
The match clock shown against a `live` match (`32'`, `90+`). The **Live Feed** reports the minute observed at the last write; the client extrapolates the ticking value from the **LiveResult**'s `updatedAt` anchor (`minute + elapsed since last write`), clamped at each **Match Phase**'s ceiling (`45+`, `90+`, `120+`) so it never overruns. No minute is shown during `penalties`. Like the **Match Phase** it is a display fact only (ADR 0029).

### Kickoff
The scheduled start instant of a match, taken from its `date` and timezone-bearing `time` in `data/worldcup.json` and resolved to an absolute UTC instant. The **Live Feed Poller** compares it against the current time to decide when a match auto-starts; the **Live Feed** uses it as the anchor from which a match's duration is measured, and the Poller uses `Kickoff + 3h` as the force-finish boundary (see **Live Feed Poller**).

### Match Number
The stable identifier of a match (`num`), unique across the tournament: 1 through 72 for the group-stage matches in chronological order, continuing with the pre-existing knockout numbering (73 onward). It is the identifier a **LiveResult** is keyed by, and the value the live-update API addresses.

### Imported Community
A **Community** whose Bets did not originate on the platform but were bulk-loaded from an external sheet by an Admin. Unlike a native Community — whose members each create and own their own Bets — an Imported Community has a **single Import Owner** that holds *every* imported Bet, one per spreadsheet participant; the participant's identity lives in the Bet **label**, not in a User. It is marked as imported so it can be told apart from native Communities (only Imported Communities may be refreshed by re-import). Real external participants do not own Bets here: they join via the **Invite Link** purely to view the **Leaderboard**. Imported Bets are **Direct Bets**, and as such are exempt from the **Bet Deadline** and the **Bet Limit** — the external community owns its own data quality, and the platform records what they submit even after the Window has closed.

### Import Owner
The single placeholder **User** that owns all Bets of an **Imported Community** and is its sole real **Community Member**. It exists only to anchor the imported Bets and the Community; nobody authenticates as it (its email is a non-deliverable synthetic address). Its **Profile** name is the Community's name, and it holds the ordinary `user` role. Refreshing an Imported Community means deleting all of the Import Owner's Bets and recreating them from a new sheet; the Import Owner and the Community itself persist across refreshes.

### Label Obfuscation
The visibility rule that hides a participant's real-world name when an **Imported Community**'s Bet **label** is shown to anyone other than its **Community Owner**. A label reads `<NUM> | <name>`; the `<NUM>` prefix is always shown verbatim, but to a non-owner viewer the `<name>` is reduced to the first two and last two **alphanumeric** characters of its first and last whitespace-delimited tokens (so a trailing `CASA 1` exposes `1`, not `A1`), with the middle hidden behind a blurred censure banner — and a name of four or fewer alphanumeric characters is hidden entirely. Only the Community Owner (the **Import Owner**, reached via impersonation) ever sees the full name; fellow Members, and Admins browsing ordinary (non-admin) pages, see it obfuscated. It applies **only** to Imported Communities — native Community labels are always shown in full — and only on member-facing surfaces (the **Leaderboard** and the peer Bet view); the admin panel is exempt and shows full labels.
