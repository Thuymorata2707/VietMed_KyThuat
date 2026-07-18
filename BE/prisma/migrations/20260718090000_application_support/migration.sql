-- CreateTable
CREATE TABLE `ApplicationSupportCase` (
    `id` VARCHAR(191) NOT NULL,
    `engineerId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NULL,
    `machineId` VARCHAR(191) NULL,
    `machineModelId` VARCHAR(191) NULL,
    `supportedAt` DATETIME(3) NOT NULL,
    `channel` ENUM('PHONE', 'ZALO', 'REMOTE', 'ONSITE', 'EMAIL', 'OTHER') NOT NULL DEFAULT 'PHONE',
    `issueCategory` ENUM('APP_ERROR', 'USER_GUIDANCE', 'CONFIGURATION', 'HIS_RIS_PACS', 'DICOM', 'WORKLIST', 'PRINTING', 'LICENSE', 'DATA_EXPORT', 'TRAINING', 'OTHER') NOT NULL DEFAULT 'APP_ERROR',
    `status` ENUM('RESOLVED', 'WAITING_CUSTOMER', 'WAITING_HOSPITAL_IT', 'WAITING_VENDOR', 'NEEDS_ONSITE', 'FOLLOW_UP') NOT NULL DEFAULT 'RESOLVED',
    `customerName` VARCHAR(191) NULL,
    `contactName` VARCHAR(191) NULL,
    `contactPhone` VARCHAR(191) NULL,
    `appModule` VARCHAR(191) NULL,
    `machineText` VARCHAR(191) NULL,
    `impactLevel` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `issueDescription` TEXT NOT NULL,
    `resolution` TEXT NOT NULL,
    `durationMinutes` INTEGER NULL,
    `pending` TEXT NULL,
    `nextAction` TEXT NULL,
    `followUpNeeded` BOOLEAN NOT NULL DEFAULT false,
    `followUpDate` DATETIME(3) NULL,
    `knowledgeCandidate` BOOLEAN NOT NULL DEFAULT false,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ApplicationSupportCase_engineerId_supportedAt_idx`(`engineerId`, `supportedAt`),
    INDEX `ApplicationSupportCase_customerId_idx`(`customerId`),
    INDEX `ApplicationSupportCase_machineId_idx`(`machineId`),
    INDEX `ApplicationSupportCase_machineModelId_idx`(`machineModelId`),
    INDEX `ApplicationSupportCase_status_idx`(`status`),
    INDEX `ApplicationSupportCase_issueCategory_idx`(`issueCategory`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ApplicationSupportCase` ADD CONSTRAINT `ApplicationSupportCase_engineerId_fkey` FOREIGN KEY (`engineerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApplicationSupportCase` ADD CONSTRAINT `ApplicationSupportCase_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApplicationSupportCase` ADD CONSTRAINT `ApplicationSupportCase_machineId_fkey` FOREIGN KEY (`machineId`) REFERENCES `Machine`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApplicationSupportCase` ADD CONSTRAINT `ApplicationSupportCase_machineModelId_fkey` FOREIGN KEY (`machineModelId`) REFERENCES `MachineModel`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
