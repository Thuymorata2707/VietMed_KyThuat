-- CreateTable
CREATE TABLE `DailyReport` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `reportDate` DATETIME(3) NOT NULL,
    `status` ENUM('DRAFT', 'SUBMITTED', 'APPROVED', 'NEEDS_REVISION') NOT NULL DEFAULT 'DRAFT',
    `summary` TEXT NULL,
    `pending` TEXT NULL,
    `proposal` TEXT NULL,
    `submittedAt` DATETIME(3) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `reviewNote` TEXT NULL,
    `reviewerId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DailyReport_userId_reportDate_key`(`userId`, `reportDate`),
    INDEX `DailyReport_reportDate_idx`(`reportDate`),
    INDEX `DailyReport_status_idx`(`status`),
    INDEX `DailyReport_reviewerId_idx`(`reviewerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkLog` (
    `id` VARCHAR(191) NOT NULL,
    `kind` ENUM('REPAIR', 'MAINTENANCE', 'INSTALLATION') NOT NULL,
    `repairId` VARCHAR(191) NULL,
    `maintenanceId` VARCHAR(191) NULL,
    `installationId` VARCHAR(191) NULL,
    `stepTime` DATETIME(3) NULL,
    `title` VARCHAR(191) NOT NULL,
    `note` TEXT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `WorkLog_kind_idx`(`kind`),
    INDEX `WorkLog_repairId_idx`(`repairId`),
    INDEX `WorkLog_maintenanceId_idx`(`maintenanceId`),
    INDEX `WorkLog_installationId_idx`(`installationId`),
    INDEX `WorkLog_createdById_idx`(`createdById`),
    INDEX `WorkLog_stepTime_idx`(`stepTime`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UsedPart` (
    `id` VARCHAR(191) NOT NULL,
    `kind` ENUM('REPAIR', 'MAINTENANCE', 'INSTALLATION') NOT NULL,
    `repairId` VARCHAR(191) NULL,
    `maintenanceId` VARCHAR(191) NULL,
    `installationId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(12, 2) NOT NULL DEFAULT 1,
    `unit` VARCHAR(191) NULL,
    `serialNumber` VARCHAR(191) NULL,
    `unitCost` DECIMAL(15, 2) NULL,
    `totalCost` DECIMAL(15, 2) NULL,
    `status` ENUM('PLANNED', 'USED', 'WAITING', 'RETURNED') NOT NULL DEFAULT 'USED',
    `inventoryItemId` VARCHAR(191) NULL,
    `note` TEXT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `UsedPart_kind_idx`(`kind`),
    INDEX `UsedPart_repairId_idx`(`repairId`),
    INDEX `UsedPart_maintenanceId_idx`(`maintenanceId`),
    INDEX `UsedPart_installationId_idx`(`installationId`),
    INDEX `UsedPart_createdById_idx`(`createdById`),
    INDEX `UsedPart_status_idx`(`status`),
    INDEX `UsedPart_usedAt_idx`(`usedAt`),
    INDEX `UsedPart_inventoryItemId_idx`(`inventoryItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TaskChecklistItem` (
    `id` VARCHAR(191) NOT NULL,
    `kind` ENUM('REPAIR', 'MAINTENANCE', 'INSTALLATION') NOT NULL,
    `repairId` VARCHAR(191) NULL,
    `maintenanceId` VARCHAR(191) NULL,
    `installationId` VARCHAR(191) NULL,
    `label` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'DONE', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
    `note` TEXT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `checkedAt` DATETIME(3) NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TaskChecklistItem_kind_idx`(`kind`),
    INDEX `TaskChecklistItem_repairId_idx`(`repairId`),
    INDEX `TaskChecklistItem_maintenanceId_idx`(`maintenanceId`),
    INDEX `TaskChecklistItem_installationId_idx`(`installationId`),
    INDEX `TaskChecklistItem_status_idx`(`status`),
    INDEX `TaskChecklistItem_updatedById_idx`(`updatedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `DailyReport` ADD CONSTRAINT `DailyReport_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DailyReport` ADD CONSTRAINT `DailyReport_reviewerId_fkey` FOREIGN KEY (`reviewerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkLog` ADD CONSTRAINT `WorkLog_repairId_fkey` FOREIGN KEY (`repairId`) REFERENCES `Repair`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkLog` ADD CONSTRAINT `WorkLog_maintenanceId_fkey` FOREIGN KEY (`maintenanceId`) REFERENCES `Maintenance`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkLog` ADD CONSTRAINT `WorkLog_installationId_fkey` FOREIGN KEY (`installationId`) REFERENCES `MachineInstallation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkLog` ADD CONSTRAINT `WorkLog_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UsedPart` ADD CONSTRAINT `UsedPart_repairId_fkey` FOREIGN KEY (`repairId`) REFERENCES `Repair`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UsedPart` ADD CONSTRAINT `UsedPart_maintenanceId_fkey` FOREIGN KEY (`maintenanceId`) REFERENCES `Maintenance`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UsedPart` ADD CONSTRAINT `UsedPart_installationId_fkey` FOREIGN KEY (`installationId`) REFERENCES `MachineInstallation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UsedPart` ADD CONSTRAINT `UsedPart_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskChecklistItem` ADD CONSTRAINT `TaskChecklistItem_repairId_fkey` FOREIGN KEY (`repairId`) REFERENCES `Repair`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskChecklistItem` ADD CONSTRAINT `TaskChecklistItem_maintenanceId_fkey` FOREIGN KEY (`maintenanceId`) REFERENCES `Maintenance`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskChecklistItem` ADD CONSTRAINT `TaskChecklistItem_installationId_fkey` FOREIGN KEY (`installationId`) REFERENCES `MachineInstallation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskChecklistItem` ADD CONSTRAINT `TaskChecklistItem_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
