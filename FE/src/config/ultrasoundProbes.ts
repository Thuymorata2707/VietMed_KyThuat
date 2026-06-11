export const ultrasoundProbeCodes = [
  'C1-6',
  'C1-6CT',
  'C1-6HT',
  'C1-6T',
  'C5-8NT',
  'CW2.0',
  'CW5.0',
  'CW8.0',
  'E3-10H',
  'EC2-11H',
  'EC3-10',
  'EC3-10H',
  'EC3-10T',
  'EC3-10X',
  'EV2-11H',
  'EV3-10',
  'EV3-10H',
  'EV3-10T',
  'EV3-10X',
  'IO7-18',
  'IO8-12',
  'IO8-17T',
  'L3-8',
  'L3-8H',
  'L3-12',
  'L3-12H',
  'L3-12HT',
  'L3-12HWD',
  'L3-12T',
  'L3-12X',
  'L3-12XT',
  'L3-15H',
  'L3-17H',
  'L3-19X',
  'L8-17H',
  'L8-17HT',
  'L8-17X',
  'L10-25H',
  'MP1-5X',
  'MS_C1-6',
  'MS_L3-12',
  'P1-5CT',
  'SC1-4H',
  'SC1-4HS',
  'SC1-6',
  'SC1-6H',
  'SC1-6HT',
  'SC1-7H',
  'SC2-9H',
  'SL3-19H',
  'SL3-19X',
  'SP1-5',
  'SP1-5T',
  'SP1-5X',
  'SP3-8',
  'SP3-8T',
  'SVC1-6',
  'SVC1-6H',
  'SVC1-6HT',
  'SVC1-6T',
  'SVC1-8H',
  'SVC1-8HT',
  'TEE3-7',
  'VC1-6T',
  'VE3-10H',
  'VE3-10HT',
] as const;

export const ultrasoundProbeOptions = ultrasoundProbeCodes.map((code) => ({
  label: code,
  value: code,
}));

export function isUltrasoundMachineModel(model?: {
  code?: string | null;
  name?: string | null;
  displayName?: string | null;
  productCategory?: string | null;
  businessLine?: { productCategory?: string | null } | null;
} | null) {
  if (!model) return false;
  const category = model.productCategory ?? model.businessLine?.productCategory;
  if (category === 'ULTRASOUND') return true;

  const modelText = [model.code, model.name, model.displayName].filter(Boolean).join(' ').toUpperCase();
  return /\b(X-CUBE|E-CUBE|MINISONO|SONOPRO|DC-|DP-)\b/.test(modelText);
}
