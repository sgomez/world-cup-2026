-- AddTable: penguin_run
-- Backward-compatible, additive migration (ADR 0003).
-- Adds the PenguinRun table with a unique constraint on (userId, playDay)
-- to enforce the once-per-UTC-day limit at the database level.

CREATE TABLE "penguin_run" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "playDay" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "bestScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "penguin_run_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "penguin_run" ADD CONSTRAINT "penguin_run_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddUniqueConstraint: at most one run per User per Play Day
CREATE UNIQUE INDEX "penguin_run_userId_playDay_key" ON "penguin_run"("userId", "playDay");
