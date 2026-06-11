CREATE TYPE "OperationalDataStatus" AS ENUM ('PENDING_REVIEW', 'VERIFIED', 'NEEDS_UPDATE');

CREATE TYPE "OperationalCreatedSource" AS ENUM ('ADMIN', 'ENGINEER', 'IMPORT', 'SYSTEM');

ALTER TABLE "Machine"
ADD COLUMN "dataStatus" "OperationalDataStatus" NOT NULL DEFAULT 'VERIFIED',
ADD COLUMN "createdSource" "OperationalCreatedSource" NOT NULL DEFAULT 'ADMIN';

CREATE INDEX "Machine_dataStatus_idx" ON "Machine"("dataStatus");
CREATE INDEX "Machine_createdSource_idx" ON "Machine"("createdSource");
