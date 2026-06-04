-- AlterEnum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'AttachmentType'
      AND e.enumlabel = 'ENGINEER_PHOTO'
  ) THEN
    ALTER TYPE "AttachmentType" ADD VALUE 'ENGINEER_PHOTO';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'AttachmentType'
      AND e.enumlabel = 'BUSINESS_LINE_IMAGE'
  ) THEN
    ALTER TYPE "AttachmentType" ADD VALUE 'BUSINESS_LINE_IMAGE';
  END IF;
END $$;

-- AlterTable
ALTER TABLE "EngineerProfile" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;

-- AlterTable
ALTER TABLE "BusinessLine" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;

-- AlterTable
ALTER TABLE "Machine" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
