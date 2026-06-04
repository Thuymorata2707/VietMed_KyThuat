-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('IMPORT', 'SPLIT_ACCESSORY', 'RESERVE', 'INSTALL', 'RETURN', 'SELL', 'ADJUST_STATUS');

-- CreateTable
CREATE TABLE "MachineInventoryMovement" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "InventoryMovementType" NOT NULL,
    "machineId" TEXT NOT NULL,
    "fromStatus" "MachineInventoryStatus",
    "toStatus" "MachineInventoryStatus" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "customerId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MachineInventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MachineInventoryMovement_code_key" ON "MachineInventoryMovement"("code");

-- AddForeignKey
ALTER TABLE "MachineInventoryMovement" ADD CONSTRAINT "MachineInventoryMovement_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineInventoryMovement" ADD CONSTRAINT "MachineInventoryMovement_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineInventoryMovement" ADD CONSTRAINT "MachineInventoryMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
