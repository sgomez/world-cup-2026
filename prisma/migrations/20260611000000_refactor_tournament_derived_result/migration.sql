-- ADR 0015: Tournament result becomes derived read model.
-- Drop stored group/knockout result columns; add manual tie-break columns.
-- Safe pre-launch per ADR 0003 (no real user data yet).

ALTER TABLE "tournament"
  DROP COLUMN IF EXISTS "result",
  DROP COLUMN IF EXISTS "advancement",
  ADD COLUMN IF NOT EXISTS "manualTieBreaks" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "thirdPlaceManualOrder" JSONB;
