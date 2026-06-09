# ADR 0014: Secret Salt on the Bet Signature

**Status:** Accepted
**Date:** 2026-06-09
**Amends:** ADR 0007 (which decided "No salt")

## Context

The Bet Signature (ADR 0007) is shown to fellow Community Members **before the Bet Deadline** as a public commitment, and the full 64-character hash is exposed in a native `title` tooltip. ADR 0007 deliberately used **no salt**, so identical scoreable content yields identical Signatures (enabling copy detection and equal-standing checks).

That no-salt choice has a cost not weighed in ADR 0007: because the Signature is `sha256` of a canonical string built only from public team codes, a targeted attacker can brute-force a *guessed* bracket offline and confirm it against a peer's published full hash — reversing that peer's prediction **before the deadline**, which is exactly what the deadline is meant to protect.

The Signature's intended use here is **stability-based tamper-evidence**: a Member records another Member's Signature when the competition starts and later confirms it is unchanged, proving the owner did not alter their Bet once matches began. This use compares the displayed value then vs. now — it does **not** require the verifier to recompute the hash from the revealed bet.

## Decision

Prefix the canonical string with a **secret, server-side salt** read from an environment variable before hashing:

```
signature = sha256(SALT + canonicalString)
```

- The salt is **secret** and **never sent to any client**. (A public prefix would add no brute-force resistance — an attacker would simply include it.)
- The salt is a **single global value** for the deployment, identical for every Bet.
- The salt is **set once before go-live and never rotated.**

## Alternatives Considered

**Keep no salt (ADR 0007 status quo).** Rejected: leaves the pre-deadline brute-force reversal of a peer's prediction open, defeating the deadline's secrecy guarantee for a determined, targeted attacker.

**Per-bet random salt.** Rejected for the same reason ADR 0007 rejected it: it would make identical bets produce different Signatures, destroying copy detection — and it is unnecessary, since a single global secret salt already defeats offline brute-force.

**Stop exposing the full hash (truncate to the 8 shown characters).** Rejected as insufficient: 8 hex characters (32 bits) invite collisions and weaken legitimate equality checks, and a determined attacker could still narrow candidates. A secret salt addresses the root cause rather than reducing the exposed surface.

## Consequences

- **Preserved:** copy detection / equal-standing checks — identical scoreable content still yields identical Signatures within the deployment (one global salt).
- **Preserved:** the stability-based tamper-evidence use case — after the deadline the prediction is frozen (writes blocked, ADR 0007) and the salt is fixed, so the displayed Signature cannot change for the whole competition. A Member records it at the start and confirms it is identical at the end.
- **Dropped:** trustless *independent* recomputation of the Signature from a revealed Bet without trusting the server. With a secret salt only the server can recompute. Accepted: this is a friends' side-project where the server already computes the displayed Signature, and the stability use case above does not need independent recomputation.
- **Hard constraint:** the salt must be set once before any commitment is shown and **never rotated**. Rotating it shifts every Signature at once, breaking every Member's "it did not change" check — the same rotation hazard ADR 0007 noted for its canonical format.
- The salt is an operational secret: losing or changing it after go-live silently invalidates all prior commitments.
