ALTER TABLE `UsedPart`
  MODIFY `kind` ENUM('REPAIR', 'MAINTENANCE', 'INSTALLATION', 'DEVICE_SERVICE') NOT NULL,
  ADD COLUMN `deviceServiceTicketId` VARCHAR(191) NULL;

CREATE INDEX `UsedPart_deviceServiceTicketId_idx` ON `UsedPart`(`deviceServiceTicketId`);

ALTER TABLE `UsedPart`
  ADD CONSTRAINT `UsedPart_deviceServiceTicketId_fkey` FOREIGN KEY (`deviceServiceTicketId`) REFERENCES `DeviceServiceTicket`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
