ALTER TABLE "MachineInstallation"
ADD COLUMN "handoverInstallerName" TEXT,
ADD COLUMN "handoverInstallerPosition" TEXT,
ADD COLUMN "handoverVehicle" TEXT,
ADD COLUMN "handoverDepartureDate" TIMESTAMP(3),
ADD COLUMN "receiverInstallAddress" TEXT,
ADD COLUMN "receiverRepresentative" TEXT,
ADD COLUMN "receiverPosition" TEXT,
ADD COLUMN "receiverPhone" TEXT,
ADD COLUMN "installedDeviceItems" JSONB,
ADD COLUMN "deviceCondition" TEXT,
ADD COLUMN "deviceConditionNote" TEXT;
