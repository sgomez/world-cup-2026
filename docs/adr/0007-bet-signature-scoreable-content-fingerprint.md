# ADR 0007: Bet Signature is a Fingerprint of Scoreable Content

**Status:** Accepted (the "No salt" decision is **amended by ADR 0014**)  
**Date:** 2026-06-07

## Context

Players want to trust one another's Bets before the **Bet Deadline** without seeing each other's predictions. The mechanism is a **Bet Signature**: a hash a player can publish early as a commitment, then have others verify against the revealed Bet after the deadline.

The score of a Bet (see `src/components/score-tab.tsx`) depends on a narrow slice of the prediction:

- the **set of teams** reaching each knockout round — R32, R16, QF, SF, F — scored per team present, regardless of who they played;
- the predicted **Champion** (Final winner);
- the predicted **third-place winner** (winner of the 3RD match).

Group standings and individual match-ups earn **zero** points directly — they only matter insofar as they determine which teams reach R32. So "Japan reaches the Round of 32" scores the same no matter which group path or opponent produced it.

We had to decide what to hash, in what form, and when.

## Decision

The Bet Signature is **SHA-256 of a canonical string built only from the bet's scoreable content** — the seven components above and nothing else.

**Inputs**, derived by rehydrating the stored prediction via `createInitialState` (ADR 0006) and reading `knockoutMatches`:

| Section | Content |
|---------|---------|
| `R32` | set of team IDs across R32 matches (32 teams) |
| `R16` | set across R16 matches (16) |
| `QF` | set across QF matches (8) |
| `SF` | set across SF matches (4) |
| `F` | set across the Final match (2) |
| `C` | Champion — Final `winnerId` (1) |
| `3RD` | third-place winner — `3RD` match `winnerId` (1) |

Team identity uses the **FIFA code, upper-cased**. Internally `team.id` is the lower-cased FIFA code (`src/lib/teams.ts`), so this is `id.toUpperCase()` — a stable, locale-independent 3-letter code.

**Canonical string**: sections in the fixed order above; within each set, IDs sorted lexicographically; `,` between IDs, `:` after the label, `|` between sections:

```
R32:ARG,BRA,…,USA|R16:…|QF:…|SF:…|F:ESP,FRA|C:ESP|3RD:CRO
```

`signature = sha256(canonicalString)`, a full 64-char hex string. The UI shows the first 8 characters with the full value in a native `title` tooltip.

**No salt.** Identical scoreable content therefore yields identical Signatures — an intentional feature (players can confirm equal standing / detect identical bets).

**Never persisted — always computed on read.** The Signature is derived data, so it is *not* stored in the database (consistent with ADR 0006: the database holds only user intent, never derived state). There is no `signature` column, no migration, and no backfill. It is recomputed from the stored prediction whenever it is displayed.

Computation lives in the Score module's server sub-path, `src/modules/score/server.ts` — `signature(content: ScoreableContent)` — the single source of truth wherever a Signature is shown. *(Originally `src/lib/bet-signature.ts`; relocated in issue #273 to eliminate the redundant raw-prediction derivation path.)*

**Shown for closed Bets only.** A Signature is rendered only when the Bet's `status` is `closed`. A closeable Bet always has all 32 knockout winners, so all seven components resolve. Draft Bets show no Signature. Because it is computed on read, it always reflects the Bet's *current* prediction — there is no stale snapshot to reconcile after a reopen/edit.

**Tamper-evidence comes from the deadline, not from storage.** After the Bet Deadline all writes are blocked, so the stored prediction — and therefore its computed Signature — is immutable. A Signature published before the deadline can be verified against the revealed Bet afterwards regardless of whether it was ever stored.

**Visibility.** The Signature is shown wherever a closed Bet is already visible to the viewer (own list, admin panel) and, additionally, to fellow Community Members **before the deadline** — alongside label and owner, without revealing the prediction. Draft Bets remain hidden pre-deadline.

## Alternatives Considered

**Hash the full prediction (group orders + all match-ups + winners).** Rejected: it would make two bets with the same scoreable content but different group arrangements produce different Signatures, contradicting the core requirement that the Signature track exactly what is scored.

**Per-bet salt / random nonce.** Rejected: it would make identical bets produce different Signatures, defeating the intentional "identical bets → identical hash" property and the ability to detect copies.

**Hash a canonical JSON object instead of a delimited string.** Rejected: JSON introduces key-ordering and whitespace ambiguity that must be controlled anyway; a fixed delimited string is simpler and unambiguous.

**Use team names instead of FIFA codes.** Rejected: names are locale-specific (`en`/`es`, ADR 0004), so the same bet would hash differently per locale.

**Store the Signature in a column (set on close, backfill existing bets).** Rejected: the Signature is derived data, which ADR 0006 deliberately keeps out of the database. Storage adds a migration and a backfill script, and creates a stale-snapshot hazard (a closed bet reopened and edited pre-deadline would carry a Signature that no longer matches it). It buys no extra tamper-evidence, because immutability after the deadline already comes from the write block, not from persistence.

## Consequences

- The Signature is a precise, stable identity for a bet's score: same Signature ⇒ same score against any real-world outcome, forever.
- The canonical format (sections, ordering, FIFA codes, no salt) is effectively **immutable** once Signatures are published — changing it would invalidate every prior commitment. Any future scoring change that alters which data affects the score must be reconciled with this format.
- Group-stage edits that preserve the set of teams in every round leave the Signature unchanged, as required.
- No schema change, migration, or backfill is needed; the Signature is computed on every read of a closed bet. Cost is one rehydrate + sha256 per closed bet rendered — negligible for the small lists involved.
- A new pre-deadline information exposure exists: fellow Community Members can see that a member has a closed bet (label, owner, Signature), which was previously fully hidden until the deadline.
