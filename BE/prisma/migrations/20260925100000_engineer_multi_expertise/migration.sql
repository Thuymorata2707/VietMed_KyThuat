ALTER TABLE `EngineerProfile`
  ADD COLUMN `expertiseImaging` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `expertiseLabTesting` BOOLEAN NOT NULL DEFAULT false;

UPDATE `EngineerProfile`
SET
  `expertiseImaging` = COALESCE(`expertiseGroup` = 'IMAGING', false),
  `expertiseLabTesting` = COALESCE(`expertiseGroup` = 'LAB_TESTING', false);
