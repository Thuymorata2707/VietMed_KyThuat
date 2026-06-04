-- CreateEnum
CREATE TYPE "MachineInventoryStatus" AS ENUM ('IN_STOCK', 'ACCESSORY_SPLIT', 'INSTALLED', 'RESERVED', 'RETURNED', 'SOLD');

-- CreateTable
CREATE TABLE "BusinessLine" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "manufacturer" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessLine_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Machine"
ADD COLUMN "inventoryStatus" "MachineInventoryStatus" NOT NULL DEFAULT 'IN_STOCK',
ADD COLUMN "manufacturingDate" TIMESTAMP(3),
ADD COLUMN "warehouseImportDate" TIMESTAMP(3),
ADD COLUMN "businessLineId" TEXT;

-- Allow machines to exist in inventory before being installed at a customer.
ALTER TABLE "Machine" DROP CONSTRAINT "Machine_customerId_fkey";
ALTER TABLE "Machine" ALTER COLUMN "customerId" DROP NOT NULL;

-- Backfill existing installed customer machines.
UPDATE "Machine"
SET "inventoryStatus" = 'INSTALLED'
WHERE "customerId" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "BusinessLine_code_key" ON "BusinessLine"("code");

-- AddForeignKey
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_businessLineId_fkey" FOREIGN KEY ("businessLineId") REFERENCES "BusinessLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
