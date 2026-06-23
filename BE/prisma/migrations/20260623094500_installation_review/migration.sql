ALTER TABLE `MachineInstallation`
  ADD COLUMN `reviewStatus` ENUM('NOT_REQUIRED', 'PENDING', 'APPROVED', 'NEEDS_REVISION') NOT NULL DEFAULT 'NOT_REQUIRED',
  ADD COLUMN `reviewNote` VARCHAR(191) NULL,
  ADD COLUMN `reviewedAt` DATETIME(3) NULL,
  ADD COLUMN `reviewerId` VARCHAR(191) NULL;

ALTER TABLE `MachineInstallation`
  ADD INDEX `MachineInstallation_reviewStatus_idx` (`reviewStatus`),
  ADD INDEX `MachineInstallation_reviewerId_idx` (`reviewerId`);

ALTER TABLE `MachineInstallation`
  ADD CONSTRAINT `MachineInstallation_reviewerId_fkey`
  FOREIGN KEY (`reviewerId`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
