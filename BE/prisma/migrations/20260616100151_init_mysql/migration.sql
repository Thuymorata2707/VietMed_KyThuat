-- CreateTable
CREATE TABLE `ProductIndustry` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `expertiseGroup` ENUM('IMAGING', 'LAB_TESTING') NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ProductIndustry_code_key`(`code`),
    INDEX `ProductIndustry_expertiseGroup_idx`(`expertiseGroup`),
    INDEX `ProductIndustry_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Region` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Region_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Role` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Role_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `roleId` VARCHAR(191) NOT NULL,
    `regionId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DailyWorkNote` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `note` VARCHAR(191) NULL,
    `workDate` DATETIME(3) NOT NULL,
    `startTime` VARCHAR(191) NULL,
    `endTime` VARCHAR(191) NULL,
    `color` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DailyWorkNote_userId_workDate_idx`(`userId`, `workDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WeeklyReport` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `weekStart` DATETIME(3) NOT NULL,
    `status` ENUM('DRAFT', 'SUBMITTED', 'APPROVED', 'NEEDS_REVISION') NOT NULL DEFAULT 'DRAFT',
    `note` VARCHAR(191) NULL,
    `submittedAt` DATETIME(3) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `reviewerId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `WeeklyReport_weekStart_idx`(`weekStart`),
    INDEX `WeeklyReport_status_idx`(`status`),
    INDEX `WeeklyReport_reviewerId_idx`(`reviewerId`),
    UNIQUE INDEX `WeeklyReport_userId_weekStart_key`(`userId`, `weekStart`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WeeklyReportRow` (
    `id` VARCHAR(191) NOT NULL,
    `reportId` VARCHAR(191) NOT NULL,
    `workDate` DATETIME(3) NOT NULL,
    `customer` VARCHAR(191) NULL,
    `machine` VARCHAR(191) NULL,
    `content` VARCHAR(191) NULL,
    `result` VARCHAR(191) NULL,
    `pending` VARCHAR(191) NULL,
    `proposal` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `WeeklyReportRow_reportId_sortOrder_idx`(`reportId`, `sortOrder`),
    INDEX `WeeklyReportRow_workDate_idx`(`workDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Attachment` (
    `id` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `type` ENUM('ENGINEER_PHOTO', 'MACHINE_PHOTO', 'BUSINESS_LINE_IMAGE', 'ERROR_PHOTO', 'HANDOVER_MINUTES', 'MAINTENANCE_FORM', 'PART_INVOICE', 'ACCEPTANCE_PDF', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `originalName` VARCHAR(191) NOT NULL,
    `storedName` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `size` INTEGER NOT NULL,
    `path` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `uploadedById` VARCHAR(191) NULL,
    `uploadedByEmail` VARCHAR(191) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Attachment_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `Attachment_type_idx`(`type`),
    INDEX `Attachment_uploadedById_idx`(`uploadedById`),
    INDEX `Attachment_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `actorEmail` VARCHAR(191) NULL,
    `changes` JSON NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `AuditLog_actorId_idx`(`actorId`),
    INDEX `AuditLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EngineerProfile` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `employeeCode` VARCHAR(191) NULL,
    `dateOfBirth` DATETIME(3) NULL,
    `position` VARCHAR(191) NULL,
    `department` VARCHAR(191) NULL,
    `workStartDate` DATETIME(3) NULL,
    `specialties` JSON NOT NULL,
    `expertiseGroup` ENUM('IMAGING', 'LAB_TESTING') NULL,
    `certificateNo` VARCHAR(191) NULL,
    `photoUrl` TEXT NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `EngineerProfile_userId_key`(`userId`),
    UNIQUE INDEX `EngineerProfile_employeeCode_key`(`employeeCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Customer` (
    `id` VARCHAR(191) NOT NULL,
    `customerCode` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `shortName` VARCHAR(191) NULL,
    `hospitalName` VARCHAR(191) NULL,
    `customerType` ENUM('HOSPITAL', 'CLINIC', 'LAB', 'DISTRIBUTOR', 'UNIVERSITY', 'COMPANY', 'OTHER') NOT NULL DEFAULT 'HOSPITAL',
    `status` ENUM('ACTIVE', 'INACTIVE', 'POTENTIAL', 'BLACKLISTED') NOT NULL DEFAULT 'ACTIVE',
    `taxCode` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `website` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `contactPerson` VARCHAR(191) NULL,
    `contactPosition` VARCHAR(191) NULL,
    `contactPhone` VARCHAR(191) NULL,
    `contactEmail` VARCHAR(191) NULL,
    `province` VARCHAR(191) NULL,
    `district` VARCHAR(191) NULL,
    `ward` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `fullAddress` VARCHAR(191) NULL,
    `note` TEXT NULL,
    `regionId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Customer_customerCode_key`(`customerCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BusinessLine` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `manufacturer` VARCHAR(191) NULL,
    `imageUrl` TEXT NULL,
    `productCategory` ENUM('ULTRASOUND', 'LAB_TESTING', 'BIOCHEMISTRY', 'IMMUNOLOGY', 'HEMATOLOGY', 'X_RAY', 'ENDOSCOPY', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `countryOfOrigin` VARCHAR(191) NULL,
    `website` VARCHAR(191) NULL,
    `contactPerson` VARCHAR(191) NULL,
    `contactPhone` VARCHAR(191) NULL,
    `contactEmail` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `note` VARCHAR(191) NULL,
    `expertiseGroup` ENUM('IMAGING', 'LAB_TESTING') NOT NULL DEFAULT 'IMAGING',
    `productIndustryId` VARCHAR(191) NULL,
    `managerId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `BusinessLine_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MachineModel` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `businessLineId` VARCHAR(191) NOT NULL,
    `manufacturer` VARCHAR(191) NULL,
    `productCategory` ENUM('ULTRASOUND', 'LAB_TESTING', 'BIOCHEMISTRY', 'IMMUNOLOGY', 'HEMATOLOGY', 'X_RAY', 'ENDOSCOPY', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `productLine` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MachineModel_businessLineId_idx`(`businessLineId`),
    INDEX `MachineModel_status_idx`(`status`),
    UNIQUE INDEX `MachineModel_businessLineId_code_key`(`businessLineId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MachineComponent` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `machineModelId` VARCHAR(191) NOT NULL,
    `accessories` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MachineComponent_machineModelId_idx`(`machineModelId`),
    INDEX `MachineComponent_status_idx`(`status`),
    UNIQUE INDEX `MachineComponent_machineModelId_code_key`(`machineModelId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ComponentAccessory` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `requiresSerial` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `componentId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ComponentAccessory_componentId_idx`(`componentId`),
    INDEX `ComponentAccessory_status_idx`(`status`),
    UNIQUE INDEX `ComponentAccessory_componentId_code_key`(`componentId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Machine` (
    `id` VARCHAR(191) NOT NULL,
    `machineCode` VARCHAR(191) NULL,
    `serialNumber` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `imageUrl` TEXT NULL,
    `modelName` VARCHAR(191) NOT NULL,
    `version` VARCHAR(191) NULL,
    `manufacturer` VARCHAR(191) NOT NULL,
    `productCategory` ENUM('ULTRASOUND', 'LAB_TESTING', 'BIOCHEMISTRY', 'IMMUNOLOGY', 'HEMATOLOGY', 'X_RAY', 'ENDOSCOPY', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `productLine` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'MAINTENANCE', 'REPAIRING', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `inventoryStatus` ENUM('IN_STOCK', 'ACCESSORY_SPLIT', 'INSTALLED', 'RESERVED', 'RETURNED', 'SOLD') NOT NULL DEFAULT 'IN_STOCK',
    `dataStatus` ENUM('PENDING_REVIEW', 'VERIFIED', 'NEEDS_UPDATE') NOT NULL DEFAULT 'VERIFIED',
    `createdSource` ENUM('ADMIN', 'ENGINEER', 'IMPORT', 'SYSTEM') NOT NULL DEFAULT 'ADMIN',
    `manufacturingDate` DATETIME(3) NULL,
    `warehouseImportDate` DATETIME(3) NULL,
    `installDate` DATETIME(3) NULL,
    `warrantyStartDate` DATETIME(3) NULL,
    `warrantyEndDate` DATETIME(3) NULL,
    `accessoriesSnapshot` JSON NOT NULL,
    `businessLineId` VARCHAR(191) NULL,
    `machineModelId` VARCHAR(191) NULL,
    `customerId` VARCHAR(191) NULL,
    `installedById` VARCHAR(191) NULL,
    `primaryEngineerId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Machine_machineCode_key`(`machineCode`),
    UNIQUE INDEX `Machine_serialNumber_key`(`serialNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MachineAccessory` (
    `id` VARCHAR(191) NOT NULL,
    `machineId` VARCHAR(191) NOT NULL,
    `componentAccessoryId` VARCHAR(191) NULL,
    `code` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `serialNumber` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MachineAccessory_serialNumber_key`(`serialNumber`),
    INDEX `MachineAccessory_machineId_idx`(`machineId`),
    INDEX `MachineAccessory_componentAccessoryId_idx`(`componentAccessoryId`),
    INDEX `MachineAccessory_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MachineInstallation` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'INSTALLED', 'CANCELLED') NOT NULL DEFAULT 'INSTALLED',
    `machineId` VARCHAR(191) NULL,
    `plannedMachineModelId` VARCHAR(191) NULL,
    `plannedModelName` VARCHAR(191) NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `businessLineId` VARCHAR(191) NULL,
    `installedById` VARCHAR(191) NULL,
    `installedAt` DATETIME(3) NOT NULL,
    `accessories` JSON NOT NULL,
    `note` VARCHAR(191) NULL,
    `handoverInstallerName` VARCHAR(191) NULL,
    `handoverInstallerPosition` VARCHAR(191) NULL,
    `handoverVehicle` VARCHAR(191) NULL,
    `handoverDepartureDate` DATETIME(3) NULL,
    `receiverInstallAddress` VARCHAR(191) NULL,
    `receiverRepresentative` VARCHAR(191) NULL,
    `receiverPosition` VARCHAR(191) NULL,
    `receiverPhone` VARCHAR(191) NULL,
    `installedDeviceItems` JSON NULL,
    `deviceCondition` VARCHAR(191) NULL,
    `deviceConditionNote` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MachineInstallation_code_key`(`code`),
    INDEX `MachineInstallation_machineId_idx`(`machineId`),
    INDEX `MachineInstallation_plannedMachineModelId_idx`(`plannedMachineModelId`),
    INDEX `MachineInstallation_customerId_idx`(`customerId`),
    INDEX `MachineInstallation_businessLineId_idx`(`businessLineId`),
    INDEX `MachineInstallation_installedById_idx`(`installedById`),
    INDEX `MachineInstallation_installedAt_idx`(`installedAt`),
    INDEX `MachineInstallation_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WarrantyCard` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `installationId` VARCHAR(191) NOT NULL,
    `machineId` VARCHAR(191) NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NOT NULL,
    `note` VARCHAR(191) NULL,
    `issuedById` VARCHAR(191) NULL,
    `issuedByEmail` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `WarrantyCard_code_key`(`code`),
    UNIQUE INDEX `WarrantyCard_installationId_key`(`installationId`),
    INDEX `WarrantyCard_machineId_idx`(`machineId`),
    INDEX `WarrantyCard_customerId_idx`(`customerId`),
    INDEX `WarrantyCard_status_idx`(`status`),
    INDEX `WarrantyCard_startDate_idx`(`startDate`),
    INDEX `WarrantyCard_endDate_idx`(`endDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MachineInventoryMovement` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `type` ENUM('IMPORT', 'SPLIT_ACCESSORY', 'RESERVE', 'INSTALL', 'RETURN', 'SELL', 'ADJUST_STATUS') NOT NULL,
    `machineId` VARCHAR(191) NOT NULL,
    `fromStatus` ENUM('IN_STOCK', 'ACCESSORY_SPLIT', 'INSTALLED', 'RESERVED', 'RETURNED', 'SOLD') NULL,
    `toStatus` ENUM('IN_STOCK', 'ACCESSORY_SPLIT', 'INSTALLED', 'RESERVED', 'RETURNED', 'SOLD') NOT NULL,
    `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `note` VARCHAR(191) NULL,
    `customerId` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MachineInventoryMovement_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Maintenance` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `type` ENUM('PERIODIC', 'WARRANTY', 'CONTRACT', 'INTERNAL', 'OTHER') NOT NULL DEFAULT 'PERIODIC',
    `status` ENUM('SCHEDULED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
    `machineId` VARCHAR(191) NULL,
    `engineerId` VARCHAR(191) NULL,
    `scheduledDate` DATETIME(3) NOT NULL,
    `assignedAt` DATETIME(3) NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `checklist` JSON NOT NULL,
    `resultNote` VARCHAR(191) NULL,
    `nextDueDate` DATETIME(3) NULL,
    `usingDepartment` VARCHAR(191) NULL,
    `representative` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `contactPhone` VARCHAR(191) NULL,
    `deviceName` VARCHAR(191) NULL,
    `modelName` VARCHAR(191) NULL,
    `serialNumber` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Maintenance_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Repair` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_PARTS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `priority` ENUM('LOW', 'NORMAL', 'HIGH', 'URGENT') NOT NULL DEFAULT 'NORMAL',
    `machineId` VARCHAR(191) NULL,
    `engineerId` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `reportedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `assignedAt` DATETIME(3) NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `resultNote` VARCHAR(191) NULL,
    `customerFeedback` VARCHAR(191) NULL,
    `usingDepartment` VARCHAR(191) NULL,
    `representative` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `contactPhone` VARCHAR(191) NULL,
    `deviceName` VARCHAR(191) NULL,
    `modelName` VARCHAR(191) NULL,
    `serialNumber` VARCHAR(191) NULL,
    `warrantyStatus` VARCHAR(191) NULL,
    `conditionAssessment` VARCHAR(191) NULL,
    `repairMethod` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Repair_code_key`(`code`),
    INDEX `Repair_createdById_idx`(`createdById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` VARCHAR(191) NOT NULL,
    `href` VARCHAR(191) NULL,
    `entityType` VARCHAR(191) NULL,
    `entityId` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Notification_userId_readAt_createdAt_idx`(`userId`, `readAt`, `createdAt`),
    INDEX `Notification_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `Notification_createdById_idx`(`createdById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_regionId_fkey` FOREIGN KEY (`regionId`) REFERENCES `Region`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DailyWorkNote` ADD CONSTRAINT `DailyWorkNote_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WeeklyReport` ADD CONSTRAINT `WeeklyReport_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WeeklyReport` ADD CONSTRAINT `WeeklyReport_reviewerId_fkey` FOREIGN KEY (`reviewerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WeeklyReportRow` ADD CONSTRAINT `WeeklyReportRow_reportId_fkey` FOREIGN KEY (`reportId`) REFERENCES `WeeklyReport`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attachment` ADD CONSTRAINT `Attachment_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EngineerProfile` ADD CONSTRAINT `EngineerProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Customer` ADD CONSTRAINT `Customer_regionId_fkey` FOREIGN KEY (`regionId`) REFERENCES `Region`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BusinessLine` ADD CONSTRAINT `BusinessLine_productIndustryId_fkey` FOREIGN KEY (`productIndustryId`) REFERENCES `ProductIndustry`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BusinessLine` ADD CONSTRAINT `BusinessLine_managerId_fkey` FOREIGN KEY (`managerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MachineModel` ADD CONSTRAINT `MachineModel_businessLineId_fkey` FOREIGN KEY (`businessLineId`) REFERENCES `BusinessLine`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MachineComponent` ADD CONSTRAINT `MachineComponent_machineModelId_fkey` FOREIGN KEY (`machineModelId`) REFERENCES `MachineModel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ComponentAccessory` ADD CONSTRAINT `ComponentAccessory_componentId_fkey` FOREIGN KEY (`componentId`) REFERENCES `MachineComponent`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Machine` ADD CONSTRAINT `Machine_businessLineId_fkey` FOREIGN KEY (`businessLineId`) REFERENCES `BusinessLine`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Machine` ADD CONSTRAINT `Machine_machineModelId_fkey` FOREIGN KEY (`machineModelId`) REFERENCES `MachineModel`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Machine` ADD CONSTRAINT `Machine_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Machine` ADD CONSTRAINT `Machine_installedById_fkey` FOREIGN KEY (`installedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Machine` ADD CONSTRAINT `Machine_primaryEngineerId_fkey` FOREIGN KEY (`primaryEngineerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MachineAccessory` ADD CONSTRAINT `MachineAccessory_machineId_fkey` FOREIGN KEY (`machineId`) REFERENCES `Machine`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MachineAccessory` ADD CONSTRAINT `MachineAccessory_componentAccessoryId_fkey` FOREIGN KEY (`componentAccessoryId`) REFERENCES `ComponentAccessory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MachineInstallation` ADD CONSTRAINT `MachineInstallation_machineId_fkey` FOREIGN KEY (`machineId`) REFERENCES `Machine`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MachineInstallation` ADD CONSTRAINT `MachineInstallation_plannedMachineModelId_fkey` FOREIGN KEY (`plannedMachineModelId`) REFERENCES `MachineModel`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MachineInstallation` ADD CONSTRAINT `MachineInstallation_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MachineInstallation` ADD CONSTRAINT `MachineInstallation_businessLineId_fkey` FOREIGN KEY (`businessLineId`) REFERENCES `BusinessLine`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MachineInstallation` ADD CONSTRAINT `MachineInstallation_installedById_fkey` FOREIGN KEY (`installedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WarrantyCard` ADD CONSTRAINT `WarrantyCard_installationId_fkey` FOREIGN KEY (`installationId`) REFERENCES `MachineInstallation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WarrantyCard` ADD CONSTRAINT `WarrantyCard_machineId_fkey` FOREIGN KEY (`machineId`) REFERENCES `Machine`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WarrantyCard` ADD CONSTRAINT `WarrantyCard_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WarrantyCard` ADD CONSTRAINT `WarrantyCard_issuedById_fkey` FOREIGN KEY (`issuedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MachineInventoryMovement` ADD CONSTRAINT `MachineInventoryMovement_machineId_fkey` FOREIGN KEY (`machineId`) REFERENCES `Machine`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MachineInventoryMovement` ADD CONSTRAINT `MachineInventoryMovement_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MachineInventoryMovement` ADD CONSTRAINT `MachineInventoryMovement_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Maintenance` ADD CONSTRAINT `Maintenance_machineId_fkey` FOREIGN KEY (`machineId`) REFERENCES `Machine`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Maintenance` ADD CONSTRAINT `Maintenance_engineerId_fkey` FOREIGN KEY (`engineerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Repair` ADD CONSTRAINT `Repair_machineId_fkey` FOREIGN KEY (`machineId`) REFERENCES `Machine`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Repair` ADD CONSTRAINT `Repair_engineerId_fkey` FOREIGN KEY (`engineerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Repair` ADD CONSTRAINT `Repair_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
