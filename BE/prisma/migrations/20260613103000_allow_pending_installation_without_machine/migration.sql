ALTER TABLE "MachineInstallation" ALTER COLUMN "machineId" DROP NOT NULL;

ALTER TABLE "MachineInstallation" ADD COLUMN "plannedMachineModelId" TEXT;
ALTER TABLE "MachineInstallation" ADD COLUMN "plannedModelName" TEXT;

CREATE INDEX "MachineInstallation_plannedMachineModelId_idx" ON "MachineInstallation"("plannedMachineModelId");

ALTER TABLE "MachineInstallation"
ADD CONSTRAINT "MachineInstallation_plannedMachineModelId_fkey"
FOREIGN KEY ("plannedMachineModelId") REFERENCES "MachineModel"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
