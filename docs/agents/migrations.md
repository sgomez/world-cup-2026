# Migration Rules for Agents

Migrations run in a Docker container **before** the app starts. The app must stay operational across the migration. Every migration must be backward-compatible with the currently deployed code.

## Rules

1. **NOT NULL columns on existing tables require a default.** Add `@default(...)` in the Prisma schema, or include an `UPDATE` statement in the raw migration SQL to backfill existing rows before adding the constraint.

2. **No single-step renames or drops.** Rename = add new column + keep old + remove old in a later migration (once the app no longer reads the old column).

3. **Never rely on the app to fill schema gaps.** If the DB requires a value, the migration must provide it.

## Reference

See [ADR 0003](../adr/0003-migrations-must-be-backward-compatible.md) for the deployment topology and rationale.
