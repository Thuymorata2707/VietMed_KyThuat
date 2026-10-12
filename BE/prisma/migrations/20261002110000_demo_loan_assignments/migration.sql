CREATE TABLE `DemoLoanAssignment` (
  `demoLoanId` VARCHAR(191) NOT NULL,
  `engineerId` VARCHAR(191) NOT NULL,
  `isLead` BOOLEAN NOT NULL DEFAULT false,
  `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`demoLoanId`, `engineerId`),
  INDEX `DemoLoanAssignment_engineerId_assignedAt_idx` (`engineerId`, `assignedAt`),
  CONSTRAINT `DemoLoanAssignment_demoLoanId_fkey` FOREIGN KEY (`demoLoanId`) REFERENCES `DemoLoan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `DemoLoanAssignment_engineerId_fkey` FOREIGN KEY (`engineerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `DemoLoanAssignment` (`demoLoanId`, `engineerId`, `isLead`)
SELECT `id`, `engineerId`, true FROM `DemoLoan`;
