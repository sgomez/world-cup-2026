# ADR 0017: DDD Tactical Patterns + Hexagonal Vertical Slice for the User Module

**Status:** Accepted
**Date:** 2026-06-11

## Context

User profile and role management logic currently lives directly inside Next.js Server Actions (`src/app/actions/admin.ts` and `src/app/actions/profile.ts`) and Better-Auth database hooks (`src/lib/auth.ts`). Business logic and domain invariants, such as role assignment constraints (an admin cannot demote a super_admin, an admin cannot demote themselves, the first registrant is promoted to super_admin) and name validation, are scattered and implemented directly as Prisma client calls, making them difficult to unit test in isolation.

## Decision

Adopt the same vertical-slice shape established in ADR 0008 (Bet) and ADR 0010 (Community) at `src/modules/user/`:

```
src/modules/user/
  domain/          user.ts  user-repository.ts (port)  errors.ts
  application/     update-profile.ts  change-role.ts  promote-first-registrant.ts
  infrastructure/  prisma-user-repository.ts  in-memory-user-repository.ts
```

- **Aggregate.** `User` is the aggregate root. Its Value Objects are `UserProfile` (name, optional image) and `Role` (user, admin, super_admin).
- **Invariants.** The aggregate root enforces role transition invariants (e.g. self-demotion guards, super_admin immutability).
- **Persistence.** Establish a `UserRepository` port with a Prisma implementation (`PrismaUserRepository`) and a mock implementation (`InMemoryUserRepository`) for testing.
- **Adapters.** Server actions and Better-Auth hooks become thin driving adapters calling the application services instead of directly calling Prisma.

## Alternatives Considered

- **Keep direct Prisma writes.** Bypassing a domain model is simple, but as role invariants grow or security reviews occur, the lack of single-home rules and testability becomes a liability.

## Consequences

- The User module becomes the final core domain slice to adopt the hexagonal vertical-slice architecture, establishing it as the codebase default.
- Role validations and self-demotion rules are centralized and unit-testable purely in-memory.
