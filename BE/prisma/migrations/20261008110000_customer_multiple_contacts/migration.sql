CREATE TABLE `CustomerContact` (
  `id` VARCHAR(191) NOT NULL,
  `customerId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `position` VARCHAR(191) NULL,
  `phone` VARCHAR(191) NULL,
  `email` VARCHAR(191) NULL,
  `isPrimary` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `CustomerContact_customerId_isPrimary_idx` (`customerId`, `isPrimary`),
  PRIMARY KEY (`id`),
  CONSTRAINT `CustomerContact_customerId_fkey`
    FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `CustomerContact`
  (`id`, `customerId`, `name`, `position`, `phone`, `email`, `isPrimary`, `createdAt`, `updatedAt`)
SELECT
  CONCAT('legacy_', `id`),
  `id`,
  COALESCE(NULLIF(TRIM(`contactPerson`), ''), 'Liên hệ chính'),
  NULLIF(TRIM(`contactPosition`), ''),
  NULLIF(TRIM(`contactPhone`), ''),
  NULLIF(TRIM(`contactEmail`), ''),
  true,
  CURRENT_TIMESTAMP(3),
  CURRENT_TIMESTAMP(3)
FROM `Customer`
WHERE NULLIF(TRIM(`contactPerson`), '') IS NOT NULL
   OR NULLIF(TRIM(`contactPosition`), '') IS NOT NULL
   OR NULLIF(TRIM(`contactPhone`), '') IS NOT NULL
   OR NULLIF(TRIM(`contactEmail`), '') IS NOT NULL;
