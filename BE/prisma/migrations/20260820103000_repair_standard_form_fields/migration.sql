ALTER TABLE `Repair`
  ADD COLUMN `representativePosition` VARCHAR(191) NULL,
  ADD COLUMN `warrantyTerm` VARCHAR(191) NULL,
  ADD COLUMN `receivedAccessories` TEXT NULL,
  ADD COLUMN `preliminaryCause` TEXT NULL,
  ADD COLUMN `repairCostItems` TEXT NULL,
  ADD COLUMN `totalRepairCost` VARCHAR(191) NULL,
  ADD COLUMN `repairCostInWords` VARCHAR(191) NULL;
