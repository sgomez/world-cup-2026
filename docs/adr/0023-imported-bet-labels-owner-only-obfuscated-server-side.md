# ADR 0023: Imported Bet Labels Are Owner-Only, Obfuscated Server-Side

**Status:** Accepted
**Date:** 2026-06-12

## Context

In an **Imported Community** (ADR 0022) the participant's identity lives in the
Bet **label**, not in a User: a label reads `"<NUM> | <name>"`, where `<name>` is
the real-world name of the person who placed the paper prediction. Those labels
surface to ordinary viewers on two member-facing read paths — the **Leaderboard**
(one row per Bet, ADR 0018) and the peer Bet view `/communities/[slug]/bets/[betId]`
(ADR 0011/0021). A real external participant joins via the **Invite Link** purely
to compare standings, yet today they read every other participant's full name off
those surfaces.

The Community wants a privacy layer: a non-owner should not be able to read who
placed which Bet. Crucially, the names must be hidden **at the source** — a CSS
blur is not enough, because the underlying string still ships in the server
payload (RSC props / JSON) and is trivially recovered from the network tab. The
hidden letters must never leave the server.

The only real human with a legitimate need for the full names is the person who
administers that Community's data. In our model that is the **Import Owner**
(`Community.ownerId`), a synthetic `user`-role account nobody logs into directly
but which an Admin can **impersonate** (`authClient.admin.impersonateUser`). Admin
*role* alone is deliberately **not** the key — an Admin browsing the public
Leaderboard as themselves is just another non-owner there.

## Decision

A Bet label belonging to an **Imported Community** is shown in full only to the
**Community Owner**; to every other viewer the `<name>` portion is **obfuscated**,
and the hidden characters are stripped server-side before serialization.

- **Predicate.** Full label iff `community.imported === true` **and**
  `viewerId === community.ownerId`; otherwise obfuscated. Because every Bet in an
  Imported Community is owned by the single Import Owner, the Leaderboard's
  existing `isOwner = bet.userId === viewerId` check already coincides with
  `viewerId === ownerId` and is reused. Native Communities
  (`imported === false`) are unaffected — full labels for everyone, as before.
- **Algorithm.** Split the label on the first `" | "`: the `<NUM>` prefix is
  emitted **verbatim**. From the `<name>` remainder, take the **alphanumeric**
  stream — letters **and** digits (punctuation/whitespace ignored for counting).
  If it has **≤ 4** alphanumeric characters the name is hidden **entirely**;
  otherwise the exposed ends are taken from the **first** and **last
  whitespace-delimited token** — the first two alphanumeric characters of the
  first token and the last two of the last token — and the middle is hidden.
  Confining the ends to a single token keeps them legible: a trailing `CASA 1`
  exposes `1`, not `A1` pulled across the space.
- **Server contract.** An obfuscated label is serialized as a structured value —
  `{ num, head, tail, middleLen, obfuscated: true }` — where `head`/`tail` are the
  exposed ends (each up to two characters, empty when fully hidden) and
  `middleLen` is a **count only**. The hidden characters themselves are never
  present in any payload. The client renders `NUM` + `head` + a blurred censure
  banner + `tail`, the banner width proportional to `middleLen`.
- **Surfaces.** The obfuscation is applied in exactly two server read paths: the
  **Leaderboard** projection and `getPeerBet` (the peer Bet view). Both already
  receive `viewerId`; both are threaded the community's `imported` flag and owner
  identity. Leaderboard rows remain clickable through to the peer view, which
  applies the same rule, so the click-through is not a leak.
- **Admin exemption.** The admin panel (`/admin/*`) is out of scope and continues
  to show full labels. It is a trusted operator surface; the obfuscation guards
  the member-facing surfaces, not the operator's own tooling.
- **Community detail loses its Bet list.** Independently, the Community detail
  page stops listing per-member Bets for **all** Communities (native and
  imported); it now shows the Member List, a leave-Community action, and a link to
  the Leaderboard. The peer Bet view route survives and is reached **only** from
  Leaderboard rows. This removes a second imported-label surface and simplifies
  the page; for native Communities it narrows peer Bet viewing to a
  Leaderboard-driven entry point.

## Alternatives Considered

**CSS blur / client-side masking.** Rejected — the real name still ships in the
payload and is recoverable from the network response. The requirement is that the
hidden letters never leave the server.

**Admin role grants full labels.** Rejected — it would let any Admin read names on
the public Leaderboard without impersonating the Owner, widening the trust
boundary. Impersonating the Import Owner is the explicit, auditable way in.

**First-letter-per-word obfuscation** (`DAVID PINO "GORDITO CHICO"` →
`D P "G C"`). Considered and dropped in favour of whole-name first-2/last-2, which
gives a steadier visual hint without exposing one letter per word.

**Fixed-width banner** (hide the name's length). Rejected for now — a
length-proportional banner reads better; the name's length is accepted as a minor
disclosure (the letters, which are what identify the person, are still withheld).

**Delete the peer Bet view route.** Rejected — it stays for native Communities
(after-deadline peer viewing, ADR 0011) and applies the same obfuscation for
imported ones, so removal was unnecessary.

## Consequences

- The Leaderboard entry and the peer Bet view stop carrying a plain `label`
  string for imported, non-owner reads; consumers render a structured obfuscated
  value instead. The `<NUM>` prefix and the exposed token ends remain legible.
- `middleLen` discloses the original name's length to non-owners — an accepted
  trade-off for banner fidelity; the identifying letters are not disclosed.
- The owner path depends on **impersonation**: an Admin sees full imported labels
  only while impersonating that Community's Import Owner, not as themselves.
- The Community detail page no longer lists Bets for any Community; the
  Leaderboard becomes the sole in-product entry point to the peer Bet view.
- The rule keys on `Community.imported`; it rides on the column added in ADR 0022
  and needs no new schema.
