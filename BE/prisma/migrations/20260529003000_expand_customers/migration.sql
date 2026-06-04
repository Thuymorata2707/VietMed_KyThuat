-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('HOSPITAL', 'CLINIC', 'LAB', 'DISTRIBUTOR', 'UNIVERSITY', 'COMPANY', 'OTHER');

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'POTENTIAL', 'BLACKLISTED');

-- AlterTable
ALTER TABLE "Customer"
ADD COLUMN "customerCode" TEXT,
ADD COLUMN "shortName" TEXT,
ADD COLUMN "customerType" "CustomerType" NOT NULL DEFAULT 'HOSPITAL',
ADD COLUMN "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "taxCode" TEXT,
ADD COLUMN "email" TEXT,
ADD COLUMN "website" TEXT,
ADD COLUMN "contactPerson" TEXT,
ADD COLUMN "contactPosition" TEXT,
ADD COLUMN "contactPhone" TEXT,
ADD COLUMN "contactEmail" TEXT,
ADD COLUMN "province" TEXT,
ADD COLUMN "district" TEXT,
ADD COLUMN "ward" TEXT,
ADD COLUMN "fullAddress" TEXT,
ADD COLUMN "note" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Customer_customerCode_key" ON "Customer"("customerCode");
