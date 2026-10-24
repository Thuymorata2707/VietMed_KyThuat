CREATE TABLE `DataImportBatch` (
  `id` VARCHAR(191) NOT NULL,
  `sourceFileName` VARCHAR(191) NOT NULL,
  `fileHash` VARCHAR(191) NOT NULL,
  `status` ENUM('PREVIEW', 'IMPORTING', 'IMPORTED', 'FAILED') NOT NULL DEFAULT 'PREVIEW',
  `previewData` LONGTEXT NOT NULL,
  `summary` JSON NOT NULL,
  `result` JSON NULL,
  `error` TEXT NULL,
  `createdById` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `DataImportBatch_status_createdAt_idx` (`status`, `createdAt`),
  INDEX `DataImportBatch_fileHash_idx` (`fileHash`),
  INDEX `DataImportBatch_createdById_idx` (`createdById`),
  PRIMARY KEY (`id`),
  CONSTRAINT `DataImportBatch_createdById_fkey`
    FOREIGN KEY (`createdById`) REFERENCES `User`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `MachineInstallation`
  ADD COLUMN `checkedByNameSnapshot` VARCHAR(191) NULL,
  ADD COLUMN `legacySourceSheet` VARCHAR(191) NULL,
  ADD COLUMN `legacySourceRow` INTEGER NULL;

ALTER TABLE `Machine`
  ADD COLUMN `installedByNameSnapshot` VARCHAR(191) NULL,
  ADD COLUMN `checkedByNameSnapshot` VARCHAR(191) NULL;
