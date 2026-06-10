-- CreateTable
CREATE TABLE "live_result" (
    "num" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "goals1" INTEGER NOT NULL,
    "goals2" INTEGER NOT NULL,
    "penalties1" INTEGER,
    "penalties2" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "live_result_pkey" PRIMARY KEY ("num")
);
