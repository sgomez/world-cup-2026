-- CreateTable
CREATE TABLE "tournament" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "result" JSONB,
    "advancement" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tournament_pkey" PRIMARY KEY ("id")
);
