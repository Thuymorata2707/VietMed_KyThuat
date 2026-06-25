ALTER TABLE `Repair` ADD COLUMN `customerId` VARCHAR(191) NULL;
ALTER TABLE `Maintenance` ADD COLUMN `customerId` VARCHAR(191) NULL;

UPDATE `Repair`
INNER JOIN `Machine` ON `Machine`.`id` = `Repair`.`machineId`
SET `Repair`.`customerId` = `Machine`.`customerId`
WHERE `Repair`.`customerId` IS NULL AND `Machine`.`customerId` IS NOT NULL;

UPDATE `Maintenance`
INNER JOIN `Machine` ON `Machine`.`id` = `Maintenance`.`machineId`
SET `Maintenance`.`customerId` = `Machine`.`customerId`
WHERE `Maintenance`.`customerId` IS NULL AND `Machine`.`customerId` IS NOT NULL;

CREATE INDEX `Repair_customerId_idx` ON `Repair`(`customerId`);
CREATE INDEX `Maintenance_customerId_idx` ON `Maintenance`(`customerId`);

ALTER TABLE `Repair`
ADD CONSTRAINT `Repair_customerId_fkey`
FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`)
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Maintenance`
ADD CONSTRAINT `Maintenance_customerId_fkey`
FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`)
ON DELETE SET NULL ON UPDATE CASCADE;
