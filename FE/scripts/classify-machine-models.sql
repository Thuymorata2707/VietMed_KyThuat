BEGIN;

INSERT INTO "BusinessLine" (
  id,
  code,
  name,
  status,
  "productCategory",
  "expertiseGroup",
  "productIndustryId",
  "createdAt",
  "updatedAt"
)
SELECT
  'product-endoscopy',
  'PRODUCT-ENDOSCOPY',
  'Máy nội soi',
  'ACTIVE',
  'ENDOSCOPY',
  'IMAGING',
  pi.id,
  now(),
  now()
FROM "ProductIndustry" pi
WHERE pi.code = 'IMAGING'
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  "productCategory" = EXCLUDED."productCategory",
  "expertiseGroup" = EXCLUDED."expertiseGroup",
  "productIndustryId" = EXCLUDED."productIndustryId",
  "updatedAt" = now();

INSERT INTO "BusinessLine" (
  id,
  code,
  name,
  status,
  "productCategory",
  "expertiseGroup",
  "productIndustryId",
  "createdAt",
  "updatedAt"
)
SELECT
  'product-lab-testing',
  'PRODUCT-LAB-TESTING',
  'Máy xét nghiệm khác',
  'ACTIVE',
  'LAB_TESTING',
  'LAB_TESTING',
  pi.id,
  now(),
  now()
FROM "ProductIndustry" pi
WHERE pi.code = 'LAB_TESTING'
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  "productCategory" = EXCLUDED."productCategory",
  "expertiseGroup" = EXCLUDED."expertiseGroup",
  "productIndustryId" = EXCLUDED."productIndustryId",
  "updatedAt" = now();

INSERT INTO "BusinessLine" (
  id,
  code,
  name,
  status,
  "productCategory",
  "expertiseGroup",
  "productIndustryId",
  "createdAt",
  "updatedAt"
)
SELECT
  'product-physiotherapy',
  'PRODUCT-PHYSIOTHERAPY',
  'Máy VLTL',
  'ACTIVE',
  'OTHER',
  'IMAGING',
  pi.id,
  now(),
  now()
FROM "ProductIndustry" pi
WHERE pi.code = 'PHYSIOTHERAPY'
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  "productCategory" = EXCLUDED."productCategory",
  "expertiseGroup" = EXCLUDED."expertiseGroup",
  "productIndustryId" = EXCLUDED."productIndustryId",
  "updatedAt" = now();

WITH classified_base AS (
  SELECT
    mm.id,
    mm.code,
    CASE
      WHEN upper(mm.code) ~ '^(X-?CUBE|XCUBE|DC-|DP-|SONOPRO|MINISONO)' OR mm."productCategory" = 'ULTRASOUND' THEN 'ULTRASOUND'
      WHEN upper(mm.code) LIKE 'XR%' OR mm."productCategory" = 'X_RAY' THEN 'X_RAY'
      WHEN upper(mm.code) ~ '^(HD-|X-2200|X-2600)' OR mm."productCategory" = 'ENDOSCOPY' THEN 'ENDOSCOPY'
      WHEN upper(mm.code) ~ '^(BC-|HEMA)' OR mm."productCategory" = 'HEMATOLOGY' THEN 'HEMATOLOGY'
      WHEN upper(mm.code) ~ '^(BS-|BA-|BIO)' OR mm."productCategory" = 'BIOCHEMISTRY' THEN 'BIOCHEMISTRY'
      WHEN upper(mm.code) ~ '^(CL-|LUMIPULSE|IMMUSTAR)' OR mm."productCategory" = 'IMMUNOLOGY' THEN 'IMMUNOLOGY'
      WHEN upper(mm.code) ~ '^(UA-|EU-|HURO)' OR mm."productCategory" = 'LAB_TESTING' THEN 'LAB_TESTING'
      WHEN upper(coalesce(mm.manufacturer, '')) = 'MINATO'
        OR upper(mm.code) ~ '^(ALB|AUTOSPIRO|HC-|KT-|MHR|MT-|PARALLEL|QZ-|ST-|STAIR|TC-|WTS)' THEN 'PHYSIOTHERAPY'
      ELSE 'ICU'
    END AS target_group
  FROM "MachineModel" mm
), classified AS (
  SELECT
    classified_base.*,
    CASE classified_base.target_group
      WHEN 'ULTRASOUND' THEN 'PRODUCT-ULTRASOUND'
      WHEN 'X_RAY' THEN 'PRODUCT-XRAY'
      WHEN 'ENDOSCOPY' THEN 'PRODUCT-ENDOSCOPY'
      WHEN 'HEMATOLOGY' THEN 'PRODUCT-HEMATOLOGY'
      WHEN 'BIOCHEMISTRY' THEN 'PRODUCT-BIOCHEMISTRY'
      WHEN 'IMMUNOLOGY' THEN 'PRODUCT-IMMUNOLOGY'
      WHEN 'LAB_TESTING' THEN 'PRODUCT-LAB-TESTING'
      WHEN 'PHYSIOTHERAPY' THEN 'PRODUCT-PHYSIOTHERAPY'
      ELSE 'PRODUCT-ICU'
    END AS target_business_code,
    row_number() OVER (
      PARTITION BY
        CASE classified_base.target_group
          WHEN 'ULTRASOUND' THEN 'PRODUCT-ULTRASOUND'
          WHEN 'X_RAY' THEN 'PRODUCT-XRAY'
          WHEN 'ENDOSCOPY' THEN 'PRODUCT-ENDOSCOPY'
          WHEN 'HEMATOLOGY' THEN 'PRODUCT-HEMATOLOGY'
          WHEN 'BIOCHEMISTRY' THEN 'PRODUCT-BIOCHEMISTRY'
          WHEN 'IMMUNOLOGY' THEN 'PRODUCT-IMMUNOLOGY'
          WHEN 'LAB_TESTING' THEN 'PRODUCT-LAB-TESTING'
          WHEN 'PHYSIOTHERAPY' THEN 'PRODUCT-PHYSIOTHERAPY'
          ELSE 'PRODUCT-ICU'
        END,
        classified_base.code
      ORDER BY classified_base.id
    ) AS duplicate_order
  FROM classified_base
)
UPDATE "MachineModel" mm
SET
  "businessLineId" = bl.id,
  code = CASE
    WHEN classified.duplicate_order > 1 THEN classified.code || '-' || classified.duplicate_order::text
    ELSE classified.code
  END,
  "productCategory" = (CASE classified.target_group
    WHEN 'ULTRASOUND' THEN 'ULTRASOUND'
    WHEN 'X_RAY' THEN 'X_RAY'
    WHEN 'ENDOSCOPY' THEN 'ENDOSCOPY'
    WHEN 'HEMATOLOGY' THEN 'HEMATOLOGY'
    WHEN 'BIOCHEMISTRY' THEN 'BIOCHEMISTRY'
    WHEN 'IMMUNOLOGY' THEN 'IMMUNOLOGY'
    WHEN 'LAB_TESTING' THEN 'LAB_TESTING'
    ELSE 'OTHER'
  END)::"MachineProductCategory",
  "updatedAt" = now()
FROM classified
JOIN "BusinessLine" bl ON bl.code = classified.target_business_code
WHERE mm.id = classified.id;

COMMIT;
