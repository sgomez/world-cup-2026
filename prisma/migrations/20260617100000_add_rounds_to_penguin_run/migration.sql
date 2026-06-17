-- AddColumn: rounds JSON array to penguin_run
-- Backward-compatible, additive migration (ADR 0003).
-- Stores the per-Round capture (roundNumber, startedAt, endedAt, score)
-- as a JSON array on the PenguinRun row. Existing rows default to '[]'.

ALTER TABLE "penguin_run" ADD COLUMN "rounds" JSONB NOT NULL DEFAULT '[]';
