ALTER TABLE `Customer`
  ADD COLUMN `importReviewRegionId` VARCHAR(191) NULL,
  ADD INDEX `Customer_importReviewRegionId_idx` (`importReviewRegionId`),
  ADD CONSTRAINT `Customer_importReviewRegionId_fkey`
    FOREIGN KEY (`importReviewRegionId`) REFERENCES `Region`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Machine`
  ADD COLUMN `importReviewRegionId` VARCHAR(191) NULL,
  ADD INDEX `Machine_importReviewRegionId_idx` (`importReviewRegionId`),
  ADD CONSTRAINT `Machine_importReviewRegionId_fkey`
    FOREIGN KEY (`importReviewRegionId`) REFERENCES `Region`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE `Machine` AS m
JOIN `DataImportBatch` AS b
  ON b.`status` = 'IMPORTED'
JOIN `User` AS u
  ON u.`id` = b.`createdById`
SET m.`importReviewRegionId` = u.`regionId`
WHERE m.`createdSource` = 'IMPORT'
  AND m.`importReviewRegionId` IS NULL;

UPDATE `Customer` AS c
JOIN `Machine` AS m
  ON m.`customerId` = c.`id`
JOIN `DataImportBatch` AS b
  ON b.`status` = 'IMPORTED'
JOIN `User` AS u
  ON u.`id` = b.`createdById`
SET c.`importReviewRegionId` = u.`regionId`
WHERE c.`regionId` IS NULL
  AND c.`importReviewRegionId` IS NULL
  AND m.`createdSource` = 'IMPORT';
