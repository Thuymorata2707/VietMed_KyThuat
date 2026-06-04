-- AlterTable
ALTER TABLE "Machine"
ADD COLUMN "installedById" TEXT,
ADD COLUMN "primaryEngineerId" TEXT;

-- AddForeignKey
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_installedById_fkey" FOREIGN KEY ("installedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_primaryEngineerId_fkey" FOREIGN KEY ("primaryEngineerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
