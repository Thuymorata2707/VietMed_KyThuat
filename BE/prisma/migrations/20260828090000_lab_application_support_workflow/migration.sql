ALTER TABLE `ApplicationSupportCase`
  ADD COLUMN `workType` ENUM('APP_SUPPORT', 'REAGENT_SETUP', 'QC_CALIBRATION', 'LIS_HIS', 'TRAINING', 'FOLLOW_UP', 'OTHER') NOT NULL DEFAULT 'APP_SUPPORT',
  ADD COLUMN `reagentName` VARCHAR(191) NULL,
  ADD COLUMN `reagentLot` VARCHAR(191) NULL,
  ADD COLUMN `reagentExpiry` DATETIME(3) NULL,
  ADD COLUMN `assayName` VARCHAR(191) NULL,
  ADD COLUMN `qcResult` VARCHAR(191) NULL,
  ADD COLUMN `calibrationResult` VARCHAR(191) NULL,
  ADD COLUMN `lisHisStatus` VARCHAR(191) NULL;

CREATE INDEX `ApplicationSupportCase_workType_idx` ON `ApplicationSupportCase`(`workType`);
