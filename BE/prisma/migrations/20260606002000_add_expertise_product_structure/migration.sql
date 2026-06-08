CREATE TYPE "ExpertiseGroup" AS ENUM ('IMAGING', 'LAB_TESTING');

ALTER TABLE "EngineerProfile"
ADD COLUMN "expertiseGroup" "ExpertiseGroup";

ALTER TABLE "BusinessLine"
ADD COLUMN "expertiseGroup" "ExpertiseGroup" NOT NULL DEFAULT 'IMAGING';

CREATE TABLE "MachineComponent" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "status" "BusinessLineStatus" NOT NULL DEFAULT 'ACTIVE',
  "machineModelId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MachineComponent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComponentAccessory" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "requiresSerial" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "status" "BusinessLineStatus" NOT NULL DEFAULT 'ACTIVE',
  "componentId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ComponentAccessory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MachineComponent_machineModelId_code_key" ON "MachineComponent"("machineModelId", "code");
CREATE INDEX "MachineComponent_machineModelId_idx" ON "MachineComponent"("machineModelId");
CREATE INDEX "MachineComponent_status_idx" ON "MachineComponent"("status");

CREATE UNIQUE INDEX "ComponentAccessory_componentId_code_key" ON "ComponentAccessory"("componentId", "code");
CREATE INDEX "ComponentAccessory_componentId_idx" ON "ComponentAccessory"("componentId");
CREATE INDEX "ComponentAccessory_status_idx" ON "ComponentAccessory"("status");

ALTER TABLE "MachineComponent" ADD CONSTRAINT "MachineComponent_machineModelId_fkey"
FOREIGN KEY ("machineModelId") REFERENCES "MachineModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ComponentAccessory" ADD CONSTRAINT "ComponentAccessory_componentId_fkey"
FOREIGN KEY ("componentId") REFERENCES "MachineComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
