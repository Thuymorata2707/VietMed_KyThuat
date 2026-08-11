-- Phụ kiện gắn trực tiếp vào Model máy (componentId trở thành tùy chọn, chỉ để phân nhóm).

-- 1. Thêm cột nullable trước (MySQL không cho thêm NOT NULL vào bảng có dữ liệu)
ALTER TABLE `ComponentAccessory` ADD COLUMN `machineModelId` VARCHAR(191) NULL;

-- 2. Backfill machineModelId từ component tương ứng
UPDATE `ComponentAccessory` ca
INNER JOIN `MachineComponent` c ON c.id = ca.componentId
SET ca.machineModelId = c.machineModelId;

-- 3. Phòng hờ dữ liệu lệch: nếu còn phụ kiện không có model thì xóa (không nên xảy ra vì componentId từng bắt buộc)
DELETE ca FROM `ComponentAccessory` ca WHERE ca.machineModelId IS NULL;

-- 4. Bỏ khóa ngoài và unique cũ trước khi sửa cột
ALTER TABLE `ComponentAccessory` DROP FOREIGN KEY `ComponentAccessory_componentId_fkey`;
DROP INDEX `ComponentAccessory_componentId_code_key` ON `ComponentAccessory`;

-- 5. componentId thành tùy chọn, machineModelId thành bắt buộc
ALTER TABLE `ComponentAccessory`
    MODIFY `componentId` VARCHAR(191) NULL,
    MODIFY `machineModelId` VARCHAR(191) NOT NULL;

-- 6. Index + unique mới theo model
CREATE INDEX `ComponentAccessory_machineModelId_idx` ON `ComponentAccessory`(`machineModelId`);
CREATE UNIQUE INDEX `ComponentAccessory_machineModelId_code_key` ON `ComponentAccessory`(`machineModelId`, `code`);

-- 7. Khóa ngoại mới
ALTER TABLE `ComponentAccessory`
    ADD CONSTRAINT `ComponentAccessory_machineModelId_fkey`
        FOREIGN KEY (`machineModelId`) REFERENCES `MachineModel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `ComponentAccessory_componentId_fkey`
        FOREIGN KEY (`componentId`) REFERENCES `MachineComponent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
