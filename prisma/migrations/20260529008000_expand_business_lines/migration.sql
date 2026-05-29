-- CreateEnum
CREATE TYPE "BusinessLineStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "BusinessLine"
ADD COLUMN "status" "BusinessLineStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "productCategory" "MachineProductCategory" NOT NULL DEFAULT 'OTHER',
ADD COLUMN "countryOfOrigin" TEXT,
ADD COLUMN "website" TEXT,
ADD COLUMN "contactPerson" TEXT,
ADD COLUMN "contactPhone" TEXT,
ADD COLUMN "contactEmail" TEXT,
ADD COLUMN "note" TEXT,
ADD COLUMN "managerId" TEXT;

-- AddForeignKey
ALTER TABLE "BusinessLine" ADD CONSTRAINT "BusinessLine_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
