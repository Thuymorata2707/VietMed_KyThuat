CREATE TABLE "ProductIndustry" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "expertiseGroup" "ExpertiseGroup" NOT NULL,
  "status" "BusinessLineStatus" NOT NULL DEFAULT 'ACTIVE',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductIndustry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductIndustry_code_key" ON "ProductIndustry"("code");
CREATE INDEX "ProductIndustry_expertiseGroup_idx" ON "ProductIndustry"("expertiseGroup");
CREATE INDEX "ProductIndustry_status_idx" ON "ProductIndustry"("status");

ALTER TABLE "BusinessLine"
ADD COLUMN "productIndustryId" TEXT;

ALTER TABLE "BusinessLine" ADD CONSTRAINT "BusinessLine_productIndustryId_fkey"
FOREIGN KEY ("productIndustryId") REFERENCES "ProductIndustry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
