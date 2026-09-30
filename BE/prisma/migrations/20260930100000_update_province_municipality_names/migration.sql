UPDATE `Province`
SET `name` = CASE `code`
  WHEN '22' THEN 'Thành phố Quảng Ninh'
  WHEN '24' THEN 'Thành phố Bắc Ninh'
  WHEN '75' THEN 'Thành phố Đồng Nai'
  ELSE `name`
END,
`updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `code` IN ('22', '24', '75');
