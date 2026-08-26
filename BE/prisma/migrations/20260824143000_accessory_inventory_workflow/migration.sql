ALTER TABLE `ComponentAccessory`
  ADD COLUMN `unit` VARCHAR(191) NOT NULL DEFAULT 'cái';

CREATE TABLE `AccessoryStockMovement` (
  `id` VARCHAR(191) NOT NULL,
  `code` VARCHAR(191) NOT NULL,
  `type` ENUM('IMPORT', 'EXPORT', 'ADJUSTMENT') NOT NULL,
  `componentAccessoryId` VARCHAR(191) NOT NULL,
  `quantityDelta` DECIMAL(12, 2) NOT NULL,
  `unit` VARCHAR(191) NULL,
  `serialNumber` VARCHAR(191) NULL,
  `unitCost` DECIMAL(15, 2) NULL,
  `unitPrice` DECIMAL(15, 2) NULL,
  `totalCost` DECIMAL(15, 2) NULL,
  `totalPrice` DECIMAL(15, 2) NULL,
  `reason` VARCHAR(191) NULL,
  `note` TEXT NULL,
  `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `machineId` VARCHAR(191) NULL,
  `customerId` VARCHAR(191) NULL,
  `repairId` VARCHAR(191) NULL,
  `maintenanceId` VARCHAR(191) NULL,
  `deviceServiceTicketId` VARCHAR(191) NULL,
  `createdById` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `AccessoryStockMovement_code_key`(`code`),
  INDEX `AccessoryStockMovement_componentAccessoryId_idx`(`componentAccessoryId`),
  INDEX `AccessoryStockMovement_machineId_idx`(`machineId`),
  INDEX `AccessoryStockMovement_customerId_idx`(`customerId`),
  INDEX `AccessoryStockMovement_repairId_idx`(`repairId`),
  INDEX `AccessoryStockMovement_maintenanceId_idx`(`maintenanceId`),
  INDEX `AccessoryStockMovement_deviceServiceTicketId_idx`(`deviceServiceTicketId`),
  INDEX `AccessoryStockMovement_createdById_idx`(`createdById`),
  INDEX `AccessoryStockMovement_type_idx`(`type`),
  INDEX `AccessoryStockMovement_occurredAt_idx`(`occurredAt`),
  INDEX `AccessoryStockMovement_serialNumber_idx`(`serialNumber`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `AccessoryStockMovement`
  ADD CONSTRAINT `AccessoryStockMovement_componentAccessoryId_fkey` FOREIGN KEY (`componentAccessoryId`) REFERENCES `ComponentAccessory`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `AccessoryStockMovement_machineId_fkey` FOREIGN KEY (`machineId`) REFERENCES `Machine`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `AccessoryStockMovement_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `AccessoryStockMovement_repairId_fkey` FOREIGN KEY (`repairId`) REFERENCES `Repair`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `AccessoryStockMovement_maintenanceId_fkey` FOREIGN KEY (`maintenanceId`) REFERENCES `Maintenance`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `AccessoryStockMovement_deviceServiceTicketId_fkey` FOREIGN KEY (`deviceServiceTicketId`) REFERENCES `DeviceServiceTicket`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `AccessoryStockMovement_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
