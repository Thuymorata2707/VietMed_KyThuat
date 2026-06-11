ALTER TABLE "Machine"
ADD COLUMN "accessoriesSnapshot" JSONB NOT NULL DEFAULT '[]';

UPDATE "Machine" AS machine
SET "accessoriesSnapshot" = COALESCE(
  (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', accessory."id",
        'componentAccessoryId', accessory."componentAccessoryId",
        'code', accessory."code",
        'name', accessory."name",
        'serialNumber', accessory."serialNumber",
        'description', accessory."description",
        'note', accessory."note"
      )
      ORDER BY accessory."name" ASC, accessory."serialNumber" ASC
    )
    FROM "MachineAccessory" AS accessory
    WHERE accessory."machineId" = machine."id"
  ),
  '[]'::jsonb
);
