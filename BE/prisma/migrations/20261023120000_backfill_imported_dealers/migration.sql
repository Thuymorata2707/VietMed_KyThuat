UPDATE `Customer` AS dealer
JOIN `Customer` AS end_user
  ON end_user.`dealerId` = dealer.`id`
SET dealer.`importReviewRegionId` = end_user.`importReviewRegionId`
WHERE dealer.`regionId` IS NULL
  AND dealer.`importReviewRegionId` IS NULL
  AND end_user.`importReviewRegionId` IS NOT NULL;
