type ProductNamingModel = {
  code?: string | null;
  name?: string | null;
  displayName?: string | null;
  manufacturer?: string | null;
  countryOfOrigin?: string | null;
  productCategory?: string | null;
  businessLine?: {
    name?: string | null;
    countryOfOrigin?: string | null;
    productCategory?: string | null;
    expertiseGroup?: string | null;
    productIndustry?: {
      name?: string | null;
      expertiseGroup?: string | null;
    } | null;
  } | null;
};

const productCategoryLabels: Record<string, string> = {
  ULTRASOUND: 'Máy siêu âm',
  LAB_TESTING: 'Máy xét nghiệm',
  BIOCHEMISTRY: 'Máy xét nghiệm sinh hóa',
  IMMUNOLOGY: 'Máy xét nghiệm miễn dịch',
  HEMATOLOGY: 'Máy xét nghiệm huyết học',
  X_RAY: 'Máy X-Quang',
  ENDOSCOPY: 'Máy nội soi',
  ICU: 'Thiết bị ICU',
  OTHER: 'Thiết bị y tế',
};

export function machineDisplayName(model?: ProductNamingModel | null) {
  if (!model) return '';

  const modelName = machineModelName(model);
  const category =
    categoryLabel(model.productCategory) ||
    categoryLabel(model.businessLine?.productCategory) ||
    normalizeProductName(model.businessLine?.name) ||
    normalizeProductName(model.businessLine?.productIndustry?.name);

  return [modelName, category].filter(Boolean).join(' - ');
}

export function machineModelName(model?: ProductNamingModel | null) {
  return model?.code || model?.displayName || model?.name || '';
}

export function machineProductName(model?: ProductNamingModel | null) {
  if (!model) return '';

  const modelName = machineModelName(model);
  const category =
    categoryLabel(model.productCategory) ||
    categoryLabel(model.businessLine?.productCategory) ||
    normalizeProductName(model.businessLine?.name) ||
    normalizeProductName(model.businessLine?.productIndustry?.name);

  if (category && modelName) return `${category} ${modelName}`;
  return modelName || category || '';
}

export function machineModelOptionLabel(model?: ProductNamingModel | null) {
  if (!model) return '';

  return [
    machineModelName(model),
    machineProductName(model),
    model.manufacturer,
    model.countryOfOrigin || model.businessLine?.countryOfOrigin,
  ]
    .filter(Boolean)
    .join(' | ');
}

function categoryLabel(value?: string | null) {
  if (!value) return '';
  return productCategoryLabels[value] ?? normalizeProductName(value);
}

function normalizeProductName(value?: string | null) {
  const text = value?.trim();
  if (!text) return '';
  if (/^máy\s/i.test(text) || /^thiết bị\s/i.test(text)) return text;
  return `Máy ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
}
