-- CreateTable
CREATE TABLE "MachineModel" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT,
    "status" "BusinessLineStatus" NOT NULL DEFAULT 'ACTIVE',
    "businessLineId" TEXT NOT NULL,
    "manufacturer" TEXT,
    "productCategory" "MachineProductCategory" NOT NULL DEFAULT 'OTHER',
    "productLine" TEXT,
    "description" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MachineModel_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Machine" ADD COLUMN "machineModelId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "MachineModel_businessLineId_code_key" ON "MachineModel"("businessLineId", "code");

-- CreateIndex
CREATE INDEX "MachineModel_businessLineId_idx" ON "MachineModel"("businessLineId");

-- CreateIndex
CREATE INDEX "MachineModel_status_idx" ON "MachineModel"("status");

-- AddForeignKey
ALTER TABLE "MachineModel" ADD CONSTRAINT "MachineModel_businessLineId_fkey" FOREIGN KEY ("businessLineId") REFERENCES "BusinessLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_machineModelId_fkey" FOREIGN KEY ("machineModelId") REFERENCES "MachineModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
