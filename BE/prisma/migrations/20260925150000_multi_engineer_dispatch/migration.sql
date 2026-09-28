CREATE TABLE `RepairAssignment` (
  `repairId` VARCHAR(191) NOT NULL,
  `engineerId` VARCHAR(191) NOT NULL,
  `isLead` BOOLEAN NOT NULL DEFAULT false,
  `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`repairId`, `engineerId`),
  INDEX `RepairAssignment_engineerId_assignedAt_idx` (`engineerId`, `assignedAt`),
  CONSTRAINT `RepairAssignment_repairId_fkey` FOREIGN KEY (`repairId`) REFERENCES `Repair`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `RepairAssignment_engineerId_fkey` FOREIGN KEY (`engineerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `MaintenanceAssignment` (
  `maintenanceId` VARCHAR(191) NOT NULL,
  `engineerId` VARCHAR(191) NOT NULL,
  `isLead` BOOLEAN NOT NULL DEFAULT false,
  `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`maintenanceId`, `engineerId`),
  INDEX `MaintenanceAssignment_engineerId_assignedAt_idx` (`engineerId`, `assignedAt`),
  CONSTRAINT `MaintenanceAssignment_maintenanceId_fkey` FOREIGN KEY (`maintenanceId`) REFERENCES `Maintenance`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `MaintenanceAssignment_engineerId_fkey` FOREIGN KEY (`engineerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `InstallationAssignment` (
  `installationId` VARCHAR(191) NOT NULL,
  `engineerId` VARCHAR(191) NOT NULL,
  `isLead` BOOLEAN NOT NULL DEFAULT false,
  `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`installationId`, `engineerId`),
  INDEX `InstallationAssignment_engineerId_assignedAt_idx` (`engineerId`, `assignedAt`),
  CONSTRAINT `InstallationAssignment_installationId_fkey` FOREIGN KEY (`installationId`) REFERENCES `MachineInstallation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `InstallationAssignment_engineerId_fkey` FOREIGN KEY (`engineerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `RepairAssignment` (`repairId`, `engineerId`, `isLead`)
SELECT `id`, `engineerId`, true FROM `Repair` WHERE `engineerId` IS NOT NULL;

INSERT INTO `MaintenanceAssignment` (`maintenanceId`, `engineerId`, `isLead`)
SELECT `id`, `engineerId`, true FROM `Maintenance` WHERE `engineerId` IS NOT NULL;

INSERT INTO `InstallationAssignment` (`installationId`, `engineerId`, `isLead`)
SELECT `id`, `installedById`, true FROM `MachineInstallation` WHERE `installedById` IS NOT NULL;
