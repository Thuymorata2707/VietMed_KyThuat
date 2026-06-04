export function pickChangedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: string[],
) {
  return fields.reduce<Record<string, { from: unknown; to: unknown }>>(
    (changes, field) => {
      if (!isSameValue(before[field], after[field])) {
        changes[field] = {
          from: before[field],
          to: after[field],
        };
      }

      return changes;
    },
    {},
  );
}

function isSameValue(before: unknown, after: unknown): boolean {
  if (before instanceof Date && after instanceof Date) {
    return before.getTime() === after.getTime();
  }

  return before === after;
}
