ALTER TABLE `ComponentAccessory`
  ADD COLUMN `unitCost` DECIMAL(15, 2) NULL,
  ADD COLUMN `salePrice` DECIMAL(15, 2) NULL;

ALTER TABLE `UsedPart`
  ADD COLUMN `unitPrice` DECIMAL(15, 2) NULL,
  ADD COLUMN `totalPrice` DECIMAL(15, 2) NULL;
