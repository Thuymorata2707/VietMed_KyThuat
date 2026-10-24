export function dateOnlyToIso(value: string) {
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return undefined;
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) return undefined;
  return parsed.toISOString();
}

export function isoToDateOnly(value?: string | null) {
  return value ? value.slice(0, 10) : '';
}
