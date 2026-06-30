ALTER TABLE `MachineInstallation`
  ADD COLUMN `warrantyStartDate` DATETIME(3) NULL,
  ADD COLUMN `warrantyEndDate` DATETIME(3) NULL,
  ADD COLUMN `warrantyNote` VARCHAR(191) NULL;
