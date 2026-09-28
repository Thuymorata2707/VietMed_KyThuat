CREATE TABLE `CodeSequence` (
    `scope` VARCHAR(191) NOT NULL,
    `value` BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (`scope`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
