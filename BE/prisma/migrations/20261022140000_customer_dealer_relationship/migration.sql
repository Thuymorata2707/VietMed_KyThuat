ALTER TABLE `Customer`
  ADD COLUMN `salesChannel` ENUM('DIRECT', 'DEALER') NULL,
  ADD COLUMN `dealerId` VARCHAR(191) NULL,
  ADD INDEX `Customer_dealerId_idx` (`dealerId`),
  ADD CONSTRAINT `Customer_dealerId_fkey`
    FOREIGN KEY (`dealerId`) REFERENCES `Customer`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
