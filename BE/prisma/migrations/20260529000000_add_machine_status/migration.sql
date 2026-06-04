-- CreateEnum
CREATE TYPE "MachineStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'REPAIRING', 'INACTIVE');

-- AlterTable
ALTER TABLE "Machine" ADD COLUMN "status" "MachineStatus" NOT NULL DEFAULT 'ACTIVE';
