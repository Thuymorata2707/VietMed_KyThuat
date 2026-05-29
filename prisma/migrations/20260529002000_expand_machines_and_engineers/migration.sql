-- CreateEnum
CREATE TYPE "MachineProductCategory" AS ENUM ('ULTRASOUND', 'LAB_TESTING', 'BIOCHEMISTRY', 'IMMUNOLOGY', 'HEMATOLOGY', 'X_RAY', 'ENDOSCOPY', 'OTHER');

-- AlterTable
ALTER TABLE "Machine"
ADD COLUMN "machineCode" TEXT,
ADD COLUMN "name" TEXT,
ADD COLUMN "version" TEXT,
ADD COLUMN "productCategory" "MachineProductCategory" NOT NULL DEFAULT 'OTHER',
ADD COLUMN "productLine" TEXT,
ADD COLUMN "warrantyStartDate" TIMESTAMP(3),
ADD COLUMN "warrantyEndDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "EngineerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employeeCode" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "position" TEXT,
    "department" TEXT,
    "workStartDate" TIMESTAMP(3),
    "specialties" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "certificateNo" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EngineerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Machine_machineCode_key" ON "Machine"("machineCode");

-- CreateIndex
CREATE UNIQUE INDEX "EngineerProfile_userId_key" ON "EngineerProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EngineerProfile_employeeCode_key" ON "EngineerProfile"("employeeCode");

-- AddForeignKey
ALTER TABLE "EngineerProfile" ADD CONSTRAINT "EngineerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
