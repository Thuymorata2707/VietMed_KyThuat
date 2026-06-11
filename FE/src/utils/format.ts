import { displayLabel } from './displayLabels';

export type TableRow = Record<string, unknown>;

export function readPath(row: TableRow, path: string) {
  return path.split('.').reduce<unknown>((current, key) => {
    if (current && typeof current === 'object' && key in current) {
      return (current as TableRow)[key];
    }
    return undefined;
  }, row);
}

export function formatValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return new Intl.DateTimeFormat('vi-VN').format(new Date(value));
  }
  if (typeof value === 'object') return '-';
  return displayLabel(value);
}

export function filterRows(rows: TableRow[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return rows;

  return rows.filter((row) => JSON.stringify(row).toLowerCase().includes(normalizedQuery));
}

export function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
