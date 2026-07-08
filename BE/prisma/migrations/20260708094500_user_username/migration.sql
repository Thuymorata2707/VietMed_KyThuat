ALTER TABLE `User` ADD COLUMN `username` VARCHAR(191) NULL;
CREATE UNIQUE INDEX `User_username_key` ON `User`(`username`);
