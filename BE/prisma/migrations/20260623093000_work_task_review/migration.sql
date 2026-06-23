ALTER TABLE `Repair`
  ADD COLUMN `reviewStatus` ENUM('NOT_REQUIRED', 'PENDING', 'APPROVED', 'NEEDS_REVISION') NOT NULL DEFAULT 'NOT_REQUIRED',
  ADD COLUMN `reviewNote` VARCHAR(191) NULL,
  ADD COLUMN `reviewedAt` DATETIME(3) NULL,
  ADD COLUMN `reviewerId` VARCHAR(191) NULL;

ALTER TABLE `Repair`
  ADD INDEX `Repair_reviewStatus_idx` (`reviewStatus`),
  ADD INDEX `Repair_reviewerId_idx` (`reviewerId`);

ALTER TABLE `Repair`
  ADD CONSTRAINT `Repair_reviewerId_fkey`
  FOREIGN KEY (`reviewerId`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Maintenance`
  ADD COLUMN `reviewStatus` ENUM('NOT_REQUIRED', 'PENDING', 'APPROVED', 'NEEDS_REVISION') NOT NULL DEFAULT 'NOT_REQUIRED',
  ADD COLUMN `reviewNote` VARCHAR(191) NULL,
  ADD COLUMN `reviewedAt` DATETIME(3) NULL,
  ADD COLUMN `reviewerId` VARCHAR(191) NULL;

ALTER TABLE `Maintenance`
  ADD INDEX `Maintenance_reviewStatus_idx` (`reviewStatus`),
  ADD INDEX `Maintenance_reviewerId_idx` (`reviewerId`);

ALTER TABLE `Maintenance`
  ADD CONSTRAINT `Maintenance_reviewerId_fkey`
  FOREIGN KEY (`reviewerId`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
