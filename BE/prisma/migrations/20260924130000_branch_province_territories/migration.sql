CREATE TABLE `Branch` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `Branch_code_key`(`code`),
    UNIQUE INDEX `Branch_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Province` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `Province_code_key`(`code`),
    UNIQUE INDEX `Province_name_key`(`name`),
    INDEX `Province_branchId_idx`(`branchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Customer` DROP FOREIGN KEY `Customer_regionId_fkey`;
ALTER TABLE `Customer` ADD COLUMN `provinceId` VARCHAR(191) NULL;
ALTER TABLE `Customer` MODIFY COLUMN `regionId` VARCHAR(191) NULL;
ALTER TABLE `Customer` ADD CONSTRAINT `Customer_regionId_fkey`
    FOREIGN KEY (`regionId`) REFERENCES `Region`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX `Customer_provinceId_idx` ON `Customer`(`provinceId`);
ALTER TABLE `Province` ADD CONSTRAINT `Province_branchId_fkey`
    FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Customer` ADD CONSTRAINT `Customer_provinceId_fkey`
    FOREIGN KEY (`provinceId`) REFERENCES `Province`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO `Branch` (`id`, `code`, `name`, `updatedAt`) VALUES
    ('branch-hanoi', 'HN', 'Hà Nội', CURRENT_TIMESTAMP(3)),
    ('branch-hcm', 'HCM', 'TP Hồ Chí Minh', CURRENT_TIMESTAMP(3));

INSERT INTO `Province` (`id`, `code`, `name`, `updatedAt`) VALUES
    ('province-01', '01', 'Thành phố Hà Nội', CURRENT_TIMESTAMP(3)),
    ('province-04', '04', 'Cao Bằng', CURRENT_TIMESTAMP(3)),
    ('province-08', '08', 'Tuyên Quang', CURRENT_TIMESTAMP(3)),
    ('province-11', '11', 'Điện Biên', CURRENT_TIMESTAMP(3)),
    ('province-12', '12', 'Lai Châu', CURRENT_TIMESTAMP(3)),
    ('province-14', '14', 'Sơn La', CURRENT_TIMESTAMP(3)),
    ('province-15', '15', 'Lào Cai', CURRENT_TIMESTAMP(3)),
    ('province-19', '19', 'Thái Nguyên', CURRENT_TIMESTAMP(3)),
    ('province-20', '20', 'Lạng Sơn', CURRENT_TIMESTAMP(3)),
    ('province-22', '22', 'Quảng Ninh', CURRENT_TIMESTAMP(3)),
    ('province-24', '24', 'Bắc Ninh', CURRENT_TIMESTAMP(3)),
    ('province-25', '25', 'Phú Thọ', CURRENT_TIMESTAMP(3)),
    ('province-31', '31', 'Thành phố Hải Phòng', CURRENT_TIMESTAMP(3)),
    ('province-33', '33', 'Hưng Yên', CURRENT_TIMESTAMP(3)),
    ('province-37', '37', 'Ninh Bình', CURRENT_TIMESTAMP(3)),
    ('province-38', '38', 'Thanh Hóa', CURRENT_TIMESTAMP(3)),
    ('province-40', '40', 'Nghệ An', CURRENT_TIMESTAMP(3)),
    ('province-42', '42', 'Hà Tĩnh', CURRENT_TIMESTAMP(3)),
    ('province-44', '44', 'Quảng Trị', CURRENT_TIMESTAMP(3)),
    ('province-46', '46', 'Thành phố Huế', CURRENT_TIMESTAMP(3)),
    ('province-48', '48', 'Thành phố Đà Nẵng', CURRENT_TIMESTAMP(3)),
    ('province-51', '51', 'Quảng Ngãi', CURRENT_TIMESTAMP(3)),
    ('province-52', '52', 'Gia Lai', CURRENT_TIMESTAMP(3)),
    ('province-56', '56', 'Khánh Hòa', CURRENT_TIMESTAMP(3)),
    ('province-66', '66', 'Đắk Lắk', CURRENT_TIMESTAMP(3)),
    ('province-68', '68', 'Lâm Đồng', CURRENT_TIMESTAMP(3)),
    ('province-75', '75', 'Đồng Nai', CURRENT_TIMESTAMP(3)),
    ('province-79', '79', 'Thành phố Hồ Chí Minh', CURRENT_TIMESTAMP(3)),
    ('province-80', '80', 'Tây Ninh', CURRENT_TIMESTAMP(3)),
    ('province-82', '82', 'Đồng Tháp', CURRENT_TIMESTAMP(3)),
    ('province-86', '86', 'Vĩnh Long', CURRENT_TIMESTAMP(3)),
    ('province-91', '91', 'An Giang', CURRENT_TIMESTAMP(3)),
    ('province-92', '92', 'Thành phố Cần Thơ', CURRENT_TIMESTAMP(3)),
    ('province-96', '96', 'Cà Mau', CURRENT_TIMESTAMP(3));

UPDATE `Customer` AS customer
JOIN `Province` AS province ON province.`code` = CASE LOWER(TRIM(customer.`province`))
    WHEN 'hà nội' THEN '01'
    WHEN 'cao bằng' THEN '04'
    WHEN 'hà giang' THEN '08' WHEN 'tuyên quang' THEN '08'
    WHEN 'điện biên' THEN '11'
    WHEN 'lai châu' THEN '12'
    WHEN 'sơn la' THEN '14'
    WHEN 'yên bái' THEN '15' WHEN 'lào cai' THEN '15'
    WHEN 'bắc kạn' THEN '19' WHEN 'thái nguyên' THEN '19'
    WHEN 'lạng sơn' THEN '20'
    WHEN 'quảng ninh' THEN '22'
    WHEN 'bắc giang' THEN '24' WHEN 'bắc ninh' THEN '24'
    WHEN 'vĩnh phúc' THEN '25' WHEN 'hòa bình' THEN '25' WHEN 'phú thọ' THEN '25'
    WHEN 'hải dương' THEN '31' WHEN 'hải phòng' THEN '31'
    WHEN 'thái bình' THEN '33' WHEN 'hưng yên' THEN '33'
    WHEN 'hà nam' THEN '37' WHEN 'nam định' THEN '37' WHEN 'ninh bình' THEN '37'
    WHEN 'thanh hóa' THEN '38'
    WHEN 'nghệ an' THEN '40'
    WHEN 'hà tĩnh' THEN '42'
    WHEN 'quảng bình' THEN '44' WHEN 'quảng trị' THEN '44'
    WHEN 'thừa thiên huế' THEN '46' WHEN 'huế' THEN '46'
    WHEN 'quảng nam' THEN '48' WHEN 'đà nẵng' THEN '48'
    WHEN 'kon tum' THEN '51' WHEN 'quảng ngãi' THEN '51'
    WHEN 'bình định' THEN '52' WHEN 'gia lai' THEN '52'
    WHEN 'ninh thuận' THEN '56' WHEN 'khánh hòa' THEN '56'
    WHEN 'đắk lắk' THEN '66' WHEN 'phú yên' THEN '66'
    WHEN 'đắk nông' THEN '68' WHEN 'bình thuận' THEN '68' WHEN 'lâm đồng' THEN '68'
    WHEN 'bình phước' THEN '75' WHEN 'đồng nai' THEN '75'
    WHEN 'bà rịa - vũng tàu' THEN '79' WHEN 'bà rịa-vũng tàu' THEN '79'
    WHEN 'bình dương' THEN '79' WHEN 'hồ chí minh' THEN '79' WHEN 'tp hồ chí minh' THEN '79'
    WHEN 'long an' THEN '80' WHEN 'tây ninh' THEN '80'
    WHEN 'tiền giang' THEN '82' WHEN 'đồng tháp' THEN '82'
    WHEN 'bến tre' THEN '86' WHEN 'trà vinh' THEN '86' WHEN 'vĩnh long' THEN '86'
    WHEN 'kiên giang' THEN '91' WHEN 'an giang' THEN '91'
    WHEN 'hậu giang' THEN '92' WHEN 'sóc trăng' THEN '92' WHEN 'cần thơ' THEN '92'
    WHEN 'bạc liêu' THEN '96' WHEN 'cà mau' THEN '96'
    ELSE NULL
END
SET customer.`provinceId` = province.`id`
WHERE customer.`province` IS NOT NULL;
