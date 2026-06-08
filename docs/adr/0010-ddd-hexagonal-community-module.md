# ADR 0010: DDD Tactical Patterns + Hexagonal Vertical Slice for the Community Module

**Status:** Accepted
**Date:** 2026-06-08

## Context

ADR 0008 adopted DDD tactical patterns behind a hexagonal seam for the Bet module as the **pilot**, and stated that Community and User would "migrate to the same vertical-slice shape later." This ADR records that migration for Community and the decisions specific to it.

Community write logic previously lived as anemic server actions calling Prisma directly: create, join, leave, remove-member, regenerate-invite-token, delete. The membership invariants (owner cannot leave, owner cannot be removed, only the owner may remove members or regenerate the invite token) had no single home, and slug derivation/uniqueness was entangled with the action layer.

## Decision

Adopt the same vertical-slice shape as ADR 0008 at `src/modules/community/`:

```
src/modules/community/
  domain/          community.ts  community-name.ts  community-slug.ts
                   community-repository.ts (port)  errors.ts
  application/     create-community.ts  join-community.ts  leave-community.ts
                   remove-member.ts  regenerate-invite-token.ts  delete-community.ts
  infrastructure/  prisma-community-repository.ts  in-memory-community-repository.ts
src/app/actions/communities.ts   # Next.js driving adapter (unchanged location)
```

**Aggregate.** `Community` is the aggregate root and the only entity (identity = `id`). Its Value Objects are `CommunityName` (≤200 chars, non-empty, at least one alphanumeric) and `CommunitySlug` (lowercase kebab, derivable from a name). The aggregate references its members and owner **by id only** (`memberIds: string[]`, `ownerId: string`) — it never holds a `User`, consistent with the by-id-only aggregate boundary in ADR 0008. The owner is also a member: `Community.create` seeds `memberIds` with `[ownerId]`.

**Membership invariants live in the aggregate.** `join` is idempotent; `leave` rejects the owner (`OWNER_CANNOT_LEAVE`) and non-members (`NOT_A_MEMBER`); `removeMember` rejects a non-owner actor and the owner-as-target (`FORBIDDEN`) and unknown targets (`NOT_A_MEMBER`); `regenerateInviteToken` rejects a non-owner actor (`FORBIDDEN`) and replaces the single active token (CONTEXT.md *Invite Link*, ADR 0002). Mutating methods return a new `Community` (immutable state), as `Result` values (ADR 0009).

**No temporal policy.** Unlike the Bet module, Community has no `BettingWindow` analogue — no Community operation is gated by the Bet Deadline or any clock. Nothing time-shaped is injected.

**Slug uniqueness is a global invariant, enforced in two layers.** It spans all Communities, so it cannot live in a single aggregate. The application service (`createCommunity`) derives the slug from the name and probes `repo.findBySlug` for a free `base`, `base-2`, `base-3`, … The DB unique constraint is the race-safe backstop: `PrismaCommunityRepository.save` maps a `P2002` on `slug` to `SLUG_ALREADY_EXISTS`, which the action retries. This mirrors ADR 0008's placement of cross-aggregate rules (the Bet Limit) in the application layer, not the aggregate.

**Authorization is an application/domain concern, not infrastructure.** Actions resolve the session and pass `actorId` / `ownerId` inward; the aggregate enforces owner-only operations and returns `FORBIDDEN`. The domain and application layers never import `next/headers`.

**Persistence port.** A `CommunityRepository` port (`findById`, `findBySlug`, `findByInviteToken`, `save`, `delete`) sits at the seam. `PrismaCommunityRepository` is the single place that knows the two-table `Community` / `CommunityMember` shape: `save` upserts the community row and **diffs** membership inside a `$transaction` (delete removed `userId`s, insert new ones), and maps Prisma error codes (`P2002` → `SLUG_ALREADY_EXISTS`, `P2025` → `NOT_FOUND`, else `SAVE_FAILED`). `InMemoryCommunityRepository` is the second adapter used by tests, so the aggregate and application services run with no database.

Errors flow as `Result` / `ResultAsync` values — see ADR 0009.

## Alternatives Considered

**Model `Community` and `CommunityMember` as separate aggregates.** Rejected: membership invariants (owner-cannot-leave, member-count, owner-as-member) are consistency rules over the whole member set, so the member set belongs *inside* the Community boundary. Members are referenced by id, not promoted to entities.

**Push slug uniqueness entirely into the aggregate.** Rejected for the same reason as the Bet Limit in ADR 0008: a single Community cannot see its siblings. It is an application + DB-constraint concern.

**Reuse a generic shared `Repository`/`errors` across Bet and Community.** Rejected for now: each module owns its own port and `DomainErrorCode` union (the vertical-slice principle in ADR 0008). Premature sharing would couple the slices.

## Consequences

- The Community membership rules have exactly one home (the aggregate); the actions become thin driving adapters.
- The aggregate and application services are unit-testable against `InMemoryCommunityRepository` with no database.
- **The read path diverges from the write path.** `getCommunity` (`src/app/actions/communities.ts`) does **not** go through `CommunityRepository`; it queries Prisma directly to join members and their Bet summaries (a CQRS-style read). This is deliberate — the read needs a shaped projection the write-side aggregate does not model. The **member-visibility** rule on that read is owned by the Bet module, not Community: it is a `Bet.peerVisibility(window, now)` query consumed by the `peerSummariesByOwners` application service (see ADR 0008 amendment). Community supplies only the audience (the membership check); it does not decide what a fellow Member may see of a Bet.
- Community is the second aggregate to follow the ADR 0008 pilot; User remains to migrate. The two modules now establish the pattern as the codebase default for write-side domain logic.
- The `save` membership diff is more code than a naive replace-all, but it preserves `CommunityMember` rows (and their `joinedAt`) for unchanged members.
