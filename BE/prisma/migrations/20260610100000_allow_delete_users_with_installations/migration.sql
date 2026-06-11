ALTER TABLE "MachineInstallation" ALTER COLUMN "installedById" DROP NOT NULL;

ALTER TABLE "MachineInstallation" DROP CONSTRAINT "MachineInstallation_installedById_fkey";

ALTER TABLE "MachineInstallation"
ADD CONSTRAINT "MachineInstallation_installedById_fkey"
FOREIGN KEY ("installedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
