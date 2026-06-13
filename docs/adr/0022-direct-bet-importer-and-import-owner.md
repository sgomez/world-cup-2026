# ADR 0022: Direct Bet Importer and the Import Owner

**Status:** Accepted
**Date:** 2026-06-12

## Context

ADR 0021 prepared the platform to *hold* **Direct Bets** — Bets whose scoreable
content is stored directly rather than derived from a bracket — and explicitly
deferred "the importer that turns the external feed into Direct Bets, and the
placeholder owner User and external Community + membership those bets attach to."
This ADR builds that importer.

An external community filled their predictions on **paper**, then into a
spreadsheet (format spec: [`docs/import-bet-format.md`](../import-bet-format.md)):
one row per participant, 48 country columns
carrying a single elimination-stage letter each (`D`/`O`/`C`/`S`/`F`/`B`/`G`),
which cascade into the round sets a Direct Bet needs. The data is error-prone by
construction — a participant may under-fill a round, duplicate a team, or skip
columns. The community is private and self-managed: "the integration of data
belongs to them."

The platform's native model does not fit. Native Bets are each created and owned
by a real, authenticated **User**, are gated by the **Bet Deadline** and the
**Bet Limit** (`MAX_BETS_PER_USER`, default 3), and are entered through the
group→bracket flow. None of that holds for an external bulk import of ~190
already-decided, paper-sourced predictions arriving after the deadline.

## Decision

Introduce an **Imported Community** owned by a single **Import Owner**, populated
by an Admin-only importer that produces one **Direct Bet** per spreadsheet row.

- **One owner, N bets.** Each spreadsheet participant becomes one Direct Bet, and
  *all* of them are owned by a single placeholder **Import Owner** User who is
  also the Community's sole real member. The participant's identity lives in the
  Bet **label**, not in a User. We rejected one-User-per-participant: it would
  multiply ~190 throwaway Users with synthetic emails per community and make a
  refresh wipe-and-recreate Users, not just Bets.
- **Import Owner identity.** A plain `user`-role User with a non-deliverable
  synthetic email (`<uuid>@example.com`) and the Community's name as its Profile
  name. Nobody authenticates as it. `example.com` is reserved, so the address is
  guaranteed unique and undeliverable — no real magic-link login can target it.
- **Label format.** `"<col0> | <col1>"` — the sheet's first two cells joined by
  `" | "`. A row counts as a participant row iff `col0` matches `/^\d+[TPX]$/`
  (e.g. `1T`, `52X`); everything else (metadata, header, footer, legend) is
  ignored. The raw first cell — including its `T`/`P`/`X` marker — is kept
  verbatim as `<NUM>`.
- **Rules deliberately broken.** Imported Bets are **Direct Bets**, which are born
  `closed` and already bypass the Betting Window and the Bet Limit (ADR 0021,
  #227). The importer leans on exactly that: no **Bet Deadline** check and no
  `MAX_BETS_PER_USER` check. A private external community owns its own data
  quality and submits after the deadline by design.
- **Tolerate, then skip.** `Bet.createDirect` already tolerates *under*-filled and
  duplicated rounds (#227: dedupe, cap-only validation, known-team check). Rows
  that still fail the relaxed rules — a round *over* its cap (>32 in R32, etc.),
  an unknown prediction letter, a malformed cell — are **skipped, not aborted**.
  The good rows import; the importer returns a report of skipped row numbers and
  reasons. We chose skip-and-report over abort-all (a refresh of 190 rows
  shouldn't die on one bad cell) and over silent coercion (truncating a round
  would alter scoreable content without anyone knowing).
- **Create or Reuse.** *Create* mints a new Import Owner + Imported Community from
  an Admin-supplied name. *Reuse* refreshes an existing Imported Community: it
  deletes all of the Import Owner's Bets and recreates them from the new sheet,
  keeping the Owner, the Community, its slug and its **Invite Link** intact.
  Reuse may only target Imported Communities.
- **`imported` marker column.** Add one additive boolean column to the
  `Community` table (ADR 0003) so Imported Communities are distinguishable from
  native ones. The Reuse picker lists only `imported` communities, which is the
  guard that a refresh can never wipe a real user's Community. We rejected
  inferring "imported" from the owner's `@example.com` email (a fragile
  convention coupling an authorization-critical guard to an email string).
- **Architecture.** A dedicated `importDirectBets` application use-case
  orchestrates the flow (ADR 0008/0010 hexagonal). Spreadsheet parsing is a
  domain **port** with an `exceljs` infrastructure adapter that emits parsed rows;
  the use-case maps rows through the fixed column→FIFA-code table, builds
  `ScoreableContentArrays`, and calls `Bet.createDirect`. Parse and validation run
  first, partitioning rows into a good set and a skipped report; only then does a
  single `prisma.$transaction` create/reuse the Community, ensure the Import
  Owner, delete prior Bets (on Reuse), and insert the good Bets — so a refresh is
  never left half-wiped.
- **Viewing is unchanged.** Real participants are invited as zero-Bet
  **Community Members** via the existing **Invite Link** and read the
  **Leaderboard** and score-only Bet views (ADR 0011/0021). No new viewing
  surface is built.

## Alternatives Considered

**One User per participant.** Rejected — ~190 synthetic Users per community, and a
refresh would churn Users, memberships and emails rather than just Bets.

**Abort the whole import on any bad row.** Rejected — paper-sourced data is
error-prone by construction; one malformed cell should not sink a 190-row refresh.
Skip-and-report keeps the importable majority and surfaces the rest.

**Silent coercion of over-cap rounds.** Rejected — truncating a round to its cap
changes scoreable content (and therefore Score and Signature) invisibly.

**Infer "imported" from the owner's email domain.** Rejected — it ties the guard
that protects real Communities from being wiped to a brittle string convention; an
explicit column is unambiguous.

**Public read-only leaderboard route.** Rejected for now — a new unauthenticated
surface with its own access rules, when the existing Invite Link already lets
external participants view as members.

## Consequences

- The `Community` table gains one nullable/boolean `imported` column; the Community
  aggregate and repository thread it through; native creation defaults it false.
- A new Admin-only import surface (form + `importDirectBets` use-case + `exceljs`
  parser port/adapter) is added. `exceljs` is a new dependency.
- An Imported Community concentrates all its Bets under one member, so the Members
  view shows a single card holding ~190 Bets while the Leaderboard shows one row
  per Bet (ADR 0018) — an intended consequence of identity-in-label.
- Imported Direct Bets enter the system after the **Bet Deadline** and beyond the
  **Bet Limit**; both bypasses are confined to the import path via
  `Bet.createDirect` and do not loosen any native write path.
- Refreshing is destructive-by-design for the Import Owner's Bets but bounded to
  Imported Communities by the `imported` guard.
- The Import Owner is an ordinary `user`-role row, so it surfaces in the admin user
  list and is impersonable (intended — impersonation is how its full Bet labels are
  read, ADR 0023). Promoting it to `admin` is inert (it can't authenticate; only
  super_admins impersonate, and they already outrank `admin`), so no guard is added
  for that. The one real hazard is deletion: `owner ... onDelete: Cascade` means
  deleting the Import Owner would orphan the Imported Community and its ~190 Bets.
  No user-delete surface exists today, so this is latent — **any future user-delete
  path must refuse a User that owns an `imported` Community.** (Triaged from
  sgomez/world-cup-2026#243, closed wontfix.)
- The upload is parsed entirely in memory: the server action reads the upload
  `Buffer` straight into the `exceljs` adapter (`parse(buffer): ParsedRow[]`), so
  the importer needs **no writable volume or temp dir** — no change to the
  Dockerfile or Coolify compose. The only size ceiling is the Server Action body
  limit (default 1 MB), far above the ~5 KB sheet.
