ALTER TABLE `DemoLoan`
  ADD COLUMN `handedOverById` VARCHAR(191) NULL,
  ADD COLUMN `returnedById` VARCHAR(191) NULL;

CREATE INDEX `DemoLoan_handedOverById_idx` ON `DemoLoan`(`handedOverById`);
CREATE INDEX `DemoLoan_returnedById_idx` ON `DemoLoan`(`returnedById`);

ALTER TABLE `DemoLoan`
  ADD CONSTRAINT `DemoLoan_handedOverById_fkey`
    FOREIGN KEY (`handedOverById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `DemoLoan_returnedById_fkey`
    FOREIGN KEY (`returnedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
