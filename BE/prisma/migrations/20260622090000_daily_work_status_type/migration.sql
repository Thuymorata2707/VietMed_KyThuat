ALTER TABLE `DailyWorkNote`
  ADD COLUMN `type` ENUM('WORK', 'BUSINESS_TRIP', 'LEAVE', 'REPAIR', 'INSTALLATION', 'MAINTENANCE', 'OTHER') NOT NULL DEFAULT 'WORK',
  ADD COLUMN `status` ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN `reviewedAt` DATETIME(3) NULL,
  ADD COLUMN `reviewerId` VARCHAR(191) NULL,
  ADD COLUMN `rejectReason` VARCHAR(191) NULL;

CREATE INDEX `DailyWorkNote_type_idx` ON `DailyWorkNote`(`type`);
CREATE INDEX `DailyWorkNote_status_idx` ON `DailyWorkNote`(`status`);
CREATE INDEX `DailyWorkNote_reviewerId_idx` ON `DailyWorkNote`(`reviewerId`);

ALTER TABLE `DailyWorkNote`
  ADD CONSTRAINT `DailyWorkNote_reviewerId_fkey`
  FOREIGN KEY (`reviewerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
