ALTER TABLE `Customer` ADD COLUMN `primaryEngineerId` VARCHAR(191) NULL;

CREATE INDEX `Customer_primaryEngineerId_idx` ON `Customer`(`primaryEngineerId`);

ALTER TABLE `Customer`
  ADD CONSTRAINT `Customer_primaryEngineerId_fkey`
  FOREIGN KEY (`primaryEngineerId`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
