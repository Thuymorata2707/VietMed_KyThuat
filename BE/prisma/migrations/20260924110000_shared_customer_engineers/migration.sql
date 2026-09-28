CREATE TABLE `_CustomerEngineers` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,
    UNIQUE INDEX `_CustomerEngineers_AB_unique`(`A`, `B`),
    INDEX `_CustomerEngineers_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `_CustomerEngineers`
    ADD CONSTRAINT `_CustomerEngineers_A_fkey`
    FOREIGN KEY (`A`) REFERENCES `Customer`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `_CustomerEngineers`
    ADD CONSTRAINT `_CustomerEngineers_B_fkey`
    FOREIGN KEY (`B`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

INSERT IGNORE INTO `_CustomerEngineers` (`A`, `B`)
SELECT `id`, `primaryEngineerId`
FROM `Customer`
WHERE `primaryEngineerId` IS NOT NULL;
