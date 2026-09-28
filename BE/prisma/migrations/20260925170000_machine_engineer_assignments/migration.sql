CREATE TABLE `MachineEngineerAssignment` (
  `machineId` VARCHAR(191) NOT NULL,
  `engineerId` VARCHAR(191) NOT NULL,
  `isPrimary` BOOLEAN NOT NULL DEFAULT false,
  `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`machineId`, `engineerId`),
  INDEX `MachineEngineerAssignment_engineerId_assignedAt_idx` (`engineerId`, `assignedAt`),
  CONSTRAINT `MachineEngineerAssignment_machineId_fkey` FOREIGN KEY (`machineId`) REFERENCES `Machine`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `MachineEngineerAssignment_engineerId_fkey` FOREIGN KEY (`engineerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `MachineEngineerAssignment` (`machineId`, `engineerId`, `isPrimary`)
SELECT `id`, `primaryEngineerId`, true FROM `Machine` WHERE `primaryEngineerId` IS NOT NULL;
