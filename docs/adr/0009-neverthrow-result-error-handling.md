# ADR 0009: neverthrow Result for Domain and Application Error Handling

**Status:** Accepted
**Date:** 2026-06-08

## Context

The Bet module (ADR 0008) moves write logic into a domain aggregate and application services. Invariant violations — past deadline, incomplete predictions, bet closed, invalid label, bet limit reached, not found, forbidden — must travel from the domain back to the Next.js server action and ultimately to the UI.

Two constraints shape how:

1. **i18n** (ADR 0004): user-visible strings are forbidden in code other than the message catalogs. The domain must not emit English like `"Deadline passed"`; it must emit a stable code the UI translates.
2. The aggregate is meant to be **pure and testable**. Exceptions as control flow couple call sites to `try/catch` placement and are easy to forget.

The existing actions return `{ error: string } | { success: true }` ad-hoc.

## Decision

Use [`neverthrow`](https://github.com/supermacro/neverthrow) `Result<T, E>` (and `ResultAsync<T, E>` for async I/O) as the error-handling convention in the Bet module and the modules that follow it.

- **Domain methods** return synchronous `Result<Bet, DomainError>`. `DomainError` is a typed union, each variant carrying a stable `code` (e.g. `PAST_DEADLINE`, `INCOMPLETE_PREDICTIONS`, `BET_CLOSED`, `INVALID_LABEL`, `FORBIDDEN`, `NOT_FOUND`, `LIMIT_REACHED`). No domain string is human-facing.
- **Repository methods** return `ResultAsync` for writes (`save`, `delete`); reads that model absence return `Promise<Bet | null>` (absence is not an error — the application service converts `null` to `err(NotFound)`).
- **Application services** chain with `andThen` / `map` / `mapErr`, composing the load → ownership → aggregate-method → save pipeline as one `ResultAsync`.
- **The server action** is the single translation point: `.match()` converts the `Result` into `{ errorCode } | { success: true }`. The component maps `errorCode` to a message via next-intl.

## Alternatives Considered

**Throw typed domain errors, catch in the application service.** Idiomatic TypeScript and reads cleanly, but reintroduces exceptions-as-control-flow: correctness depends on a `try/catch` being present at the right layer, and the type signature hides the failure modes. Rejected in favour of failures being explicit in the return type.

**Hand-rolled `{ ok, value } | { ok: false, error }` union.** No dependency, but we would re-implement `map`/`andThen`/`match` combinators that `neverthrow` already provides and that keep the chaining readable. Rejected as wheel-reinvention.

**Keep returning error strings.** Simplest, but bakes English into the domain, violating the i18n rule, and leaves the failure set untyped. Rejected.

## Consequences

- Adds a runtime dependency (`neverthrow`).
- Failure modes are visible in function signatures and exhaustively handled at the `.match()` boundary; the compiler flags unhandled variants.
- Sets a project-wide error-handling convention: other aggregates migrating to the ADR-0008 structure use `Result` too. Code outside the migrated modules is not retrofitted until it moves.
- Domain errors carry codes, not messages; every new error code needs a matching entry in `messages/en.json` and `messages/es.json`.
