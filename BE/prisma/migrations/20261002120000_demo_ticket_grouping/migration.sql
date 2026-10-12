ALTER TABLE `DemoLoan` ADD COLUMN `ticketCode` VARCHAR(191) NULL;

UPDATE `DemoLoan` SET `ticketCode` = `code` WHERE `ticketCode` IS NULL;

CREATE INDEX `DemoLoan_ticketCode_idx` ON `DemoLoan`(`ticketCode`);
