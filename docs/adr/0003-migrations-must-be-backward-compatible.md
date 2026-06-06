# ADR 0003: Migrations Must Keep the App Running

**Status:** Accepted  
**Date:** 2026-06-06

Migrations run in a Docker container that executes before the app container starts. The app must remain operational across the migration window, so every migration must be backward-compatible with the current running code.

## Constraints

- **No breaking schema changes in a single step.** Adding a NOT NULL column requires a default value or a two-phase migration (add nullable → backfill → add constraint).
- **Seed defaults where required.** If a new column must be non-nullable, the migration itself must supply the default or backfill existing rows — never rely on the application layer to fill gaps.
- **No column/table renames or drops without a transition period.** Rename = add new + keep old + remove old in a later migration once the app no longer references the old name.

## Consequences

- Migrations may be split across multiple deployments when a breaking change is unavoidable.
- Agents writing Prisma migrations must check for NOT NULL columns on existing tables and include `@default(...)` or an explicit `UPDATE` step.
