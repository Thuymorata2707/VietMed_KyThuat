-- CreateTable
CREATE TABLE "MachineAccessory" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "componentAccessoryId" TEXT,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "serialNumber" TEXT,
    "description" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MachineAccessory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MachineAccessory_serialNumber_key" ON "MachineAccessory"("serialNumber");

-- CreateIndex
CREATE INDEX "MachineAccessory_machineId_idx" ON "MachineAccessory"("machineId");

-- CreateIndex
CREATE INDEX "MachineAccessory_componentAccessoryId_idx" ON "MachineAccessory"("componentAccessoryId");

-- CreateIndex
CREATE INDEX "MachineAccessory_name_idx" ON "MachineAccessory"("name");

-- AddForeignKey
ALTER TABLE "MachineAccessory" ADD CONSTRAINT "MachineAccessory_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineAccessory" ADD CONSTRAINT "MachineAccessory_componentAccessoryId_fkey" FOREIGN KEY ("componentAccessoryId") REFERENCES "ComponentAccessory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
