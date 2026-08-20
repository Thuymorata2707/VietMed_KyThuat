import { Paginated, apiFetch } from '../api';
import type { UsedPartDraft, WorkAccessoryOption } from '../components/WorkUsedPartsEditor';

export type WorkPartRecord = {
  componentAccessoryId?: string | null;
  inventoryItemId?: string | null;
  name?: string | null;
  note?: string | null;
  quantity?: number | string | null;
  serialNumber?: string | null;
  unit?: string | null;
  unitCost?: number | string | null;
  unitPrice?: number | string | null;
};

export function buildUsedParts(parts?: WorkPartRecord[]): UsedPartDraft[] {
  return (parts || []).map((part) => ({
    componentAccessoryId: part.componentAccessoryId || part.inventoryItemId || '',
    name: part.name || '',
    note: part.note || '',
    quantity: Number(part.quantity || 1),
    serialNumber: part.serialNumber || '',
    unit: part.unit || 'cái',
    unitCost: Number(part.unitCost || 0),
    unitPrice: Number(part.unitPrice || 0),
  }));
}

export function normalizeUsedPartsPayload(parts: UsedPartDraft[]) {
  return parts
    .map((part) => ({
      componentAccessoryId: part.componentAccessoryId || undefined,
      name: part.name.trim() || undefined,
      note: part.note.trim() || undefined,
      quantity: Number(part.quantity || 0),
      serialNumber: part.serialNumber.trim() || undefined,
      unit: part.unit.trim() || undefined,
      unitCost: Number(part.unitCost || 0) || undefined,
      unitPrice: Number(part.unitPrice || 0) || undefined,
    }))
    .filter((part) => part.quantity > 0 && (part.componentAccessoryId || part.name));
}

export async function fetchModelAccessories(machineModelId: string) {
  if (!machineModelId) return [];

  const response = await apiFetch<Paginated<WorkAccessoryOption>>(
    `/machine-components/component-accessories?machineModelId=${machineModelId}&limit=100`,
  );
  return response.data ?? [];
}
