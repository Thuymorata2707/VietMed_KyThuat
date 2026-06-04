-- CreateEnum
CREATE TYPE "RepairStatus" AS ENUM ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_PARTS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RepairPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- AlterTable
ALTER TABLE "Repair"
ADD COLUMN "code" TEXT,
ADD COLUMN "status" "RepairStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "priority" "RepairPriority" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "assignedAt" TIMESTAMP(3),
ADD COLUMN "startedAt" TIMESTAMP(3),
ADD COLUMN "completedAt" TIMESTAMP(3),
ADD COLUMN "resultNote" TEXT,
ADD COLUMN "customerFeedback" TEXT,
ALTER COLUMN "engineerId" DROP NOT NULL;

-- Backfill code for any existing repairs before enforcing uniqueness.
UPDATE "Repair"
SET "code" = 'RP-' || to_char("createdAt", 'YYYYMMDD') || '-' || substr("id", 1, 6)
WHERE "code" IS NULL;

ALTER TABLE "Repair" ALTER COLUMN "code" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Repair_code_key" ON "Repair"("code");
