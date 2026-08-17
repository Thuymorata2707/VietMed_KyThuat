ALTER TABLE `ProductIndustry`
  MODIFY `description` TEXT NULL;

ALTER TABLE `BusinessLine`
  MODIFY `description` TEXT NULL,
  MODIFY `note` TEXT NULL;

ALTER TABLE `MachineModel`
  MODIFY `description` TEXT NULL,
  MODIFY `note` TEXT NULL;
