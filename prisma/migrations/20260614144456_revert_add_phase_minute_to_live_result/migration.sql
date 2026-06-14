/*
  Warnings:

  - You are about to drop the column `inStoppage` on the `live_result` table. All the data in the column will be lost.
  - You are about to drop the column `minute` on the `live_result` table. All the data in the column will be lost.
  - You are about to drop the column `phase` on the `live_result` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "live_result" DROP COLUMN "inStoppage",
DROP COLUMN "minute",
DROP COLUMN "phase";
