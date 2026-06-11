export type MachineAccessoryFormItem = {
  id?: string;
  componentAccessoryId?: string;
  code?: string;
  name: string;
  serialNumber?: string;
};

type AccessoryLike = Record<string, unknown>;

export function serializeMachineAccessories(value: unknown) {
  if (!Array.isArray(value)) return '';

  const items = value
    .map((item) => normalizeAccessoryItem(item))
    .filter((item): item is MachineAccessoryFormItem => Boolean(item));

  return items.length ? JSON.stringify(items) : '';
}

export function parseMachineAccessoriesInput(value: string, existingAccessories: unknown[] = [], options: { keepBlank?: boolean } = {}) {
  const parsed = parseSerializedAccessories(value) ?? parseLegacyAccessoryLines(value, existingAccessories);

  const items = parsed
    .map((item, index) => {
      const existing = existingAccessories[index] && typeof existingAccessories[index] === 'object'
        ? (existingAccessories[index] as AccessoryLike)
        : null;
      const code = item.code?.trim() || item.name?.trim();
      const name = item.name?.trim() || code;

      return {
        id: item.id || (typeof existing?.id === 'string' ? existing.id : undefined),
        componentAccessoryId: item.componentAccessoryId || undefined,
        code: code || undefined,
        name: name || '',
        serialNumber: item.serialNumber?.trim() || undefined,
      };
    });
  return options.keepBlank ? items : items.filter((item) => item.name);
}

export function makeProbeAccessory(code: string, serialNumber = ''): MachineAccessoryFormItem {
  return {
    code,
    name: code,
    serialNumber,
  };
}

export function formatMachineAccessoriesText(value: string) {
  const trimmed = value.trim();
  if (!trimmed.startsWith('[')) return value;

  return parseMachineAccessoriesInput(value)
    .map((item) => [item.name || item.code, item.serialNumber].filter(Boolean).join(' | '))
    .join('\n');
}

function normalizeAccessoryItem(item: unknown): MachineAccessoryFormItem | null {
  if (!item || typeof item !== 'object') return null;
  const accessory = item as AccessoryLike;
  const componentAccessory = typeof accessory.componentAccessory === 'object' && accessory.componentAccessory
    ? (accessory.componentAccessory as AccessoryLike)
    : null;
  const code = String(accessory.code ?? componentAccessory?.code ?? accessory.name ?? '').trim();
  const name = String(accessory.name ?? componentAccessory?.name ?? code).trim();
  const serialNumber = String(accessory.serialNumber ?? '').trim();

  return {
    id: typeof accessory.id === 'string' ? accessory.id : undefined,
    componentAccessoryId: typeof accessory.componentAccessoryId === 'string' ? accessory.componentAccessoryId : undefined,
    code: code || name,
    name: name || code,
    serialNumber,
  };
}

function parseSerializedAccessories(value: string): MachineAccessoryFormItem[] | null {
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (!trimmed.startsWith('[')) return null;

  try {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) return null;
    return parsed.map((item) => normalizeAccessoryItem(item)).filter((item): item is MachineAccessoryFormItem => Boolean(item));
  } catch {
    return null;
  }
}

function parseLegacyAccessoryLines(value: string, existingAccessories: unknown[]) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [name = '', serialNumber = '', code = ''] = line.split('|').map((part) => part.trim());
      const existing = existingAccessories[index] && typeof existingAccessories[index] === 'object'
        ? (existingAccessories[index] as AccessoryLike)
        : null;
      const existingId = typeof existing?.id === 'string' ? existing.id : undefined;
      const existingComponentId = typeof existing?.componentAccessoryId === 'string' ? existing.componentAccessoryId : undefined;

      return {
        id: existingId,
        componentAccessoryId: existingComponentId,
        name,
        code: code || name,
        serialNumber,
      };
    });
}
