-- CreateEnum
CREATE TYPE "InstallationStatus" AS ENUM ('INSTALLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WarrantyStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "MachineInstallation" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "InstallationStatus" NOT NULL DEFAULT 'INSTALLED',
    "machineId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "businessLineId" TEXT,
    "installedById" TEXT NOT NULL,
    "installedAt" TIMESTAMP(3) NOT NULL,
    "accessories" TEXT[],
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MachineInstallation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarrantyCard" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "WarrantyStatus" NOT NULL DEFAULT 'ACTIVE',
    "installationId" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "issuedById" TEXT,
    "issuedByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarrantyCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MachineInstallation_code_key" ON "MachineInstallation"("code");

-- CreateIndex
CREATE INDEX "MachineInstallation_machineId_idx" ON "MachineInstallation"("machineId");

-- CreateIndex
CREATE INDEX "MachineInstallation_customerId_idx" ON "MachineInstallation"("customerId");

-- CreateIndex
CREATE INDEX "MachineInstallation_businessLineId_idx" ON "MachineInstallation"("businessLineId");

-- CreateIndex
CREATE INDEX "MachineInstallation_installedById_idx" ON "MachineInstallation"("installedById");

-- CreateIndex
CREATE INDEX "MachineInstallation_installedAt_idx" ON "MachineInstallation"("installedAt");

-- CreateIndex
CREATE INDEX "MachineInstallation_status_idx" ON "MachineInstallation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "WarrantyCard_code_key" ON "WarrantyCard"("code");

-- CreateIndex
CREATE UNIQUE INDEX "WarrantyCard_installationId_key" ON "WarrantyCard"("installationId");

-- CreateIndex
CREATE INDEX "WarrantyCard_machineId_idx" ON "WarrantyCard"("machineId");

-- CreateIndex
CREATE INDEX "WarrantyCard_customerId_idx" ON "WarrantyCard"("customerId");

-- CreateIndex
CREATE INDEX "WarrantyCard_status_idx" ON "WarrantyCard"("status");

-- CreateIndex
CREATE INDEX "WarrantyCard_startDate_idx" ON "WarrantyCard"("startDate");

-- CreateIndex
CREATE INDEX "WarrantyCard_endDate_idx" ON "WarrantyCard"("endDate");

-- AddForeignKey
ALTER TABLE "MachineInstallation" ADD CONSTRAINT "MachineInstallation_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineInstallation" ADD CONSTRAINT "MachineInstallation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineInstallation" ADD CONSTRAINT "MachineInstallation_businessLineId_fkey" FOREIGN KEY ("businessLineId") REFERENCES "BusinessLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineInstallation" ADD CONSTRAINT "MachineInstallation_installedById_fkey" FOREIGN KEY ("installedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyCard" ADD CONSTRAINT "WarrantyCard_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "MachineInstallation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyCard" ADD CONSTRAINT "WarrantyCard_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyCard" ADD CONSTRAINT "WarrantyCard_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyCard" ADD CONSTRAINT "WarrantyCard_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
