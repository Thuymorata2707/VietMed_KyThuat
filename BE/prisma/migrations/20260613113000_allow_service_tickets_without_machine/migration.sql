ALTER TABLE "Repair" ALTER COLUMN "machineId" DROP NOT NULL;

ALTER TABLE "Maintenance" ALTER COLUMN "machineId" DROP NOT NULL;
ALTER TABLE "Maintenance" ADD COLUMN "usingDepartment" TEXT;
ALTER TABLE "Maintenance" ADD COLUMN "representative" TEXT;
ALTER TABLE "Maintenance" ADD COLUMN "address" TEXT;
ALTER TABLE "Maintenance" ADD COLUMN "contactPhone" TEXT;
ALTER TABLE "Maintenance" ADD COLUMN "deviceName" TEXT;
ALTER TABLE "Maintenance" ADD COLUMN "modelName" TEXT;
ALTER TABLE "Maintenance" ADD COLUMN "serialNumber" TEXT;
