BEGIN;

DELETE FROM "BusinessLine"
WHERE "productIndustryId" IS NULL
  AND id NOT IN (
    SELECT DISTINCT "businessLineId"
    FROM "MachineModel"
    WHERE "businessLineId" IS NOT NULL
  )
  AND id NOT IN (
    SELECT DISTINCT "businessLineId"
    FROM "Machine"
    WHERE "businessLineId" IS NOT NULL
  )
  AND id NOT IN (
    SELECT DISTINCT "businessLineId"
    FROM "MachineInstallation"
    WHERE "businessLineId" IS NOT NULL
  );

COMMIT;
