// Deterministic id generation for new evidence, briefs, history entries (E-xx, RB-xx, H-xxx).

/**
 * Next id in a prefixed sequence, one past the highest existing number.
 * nextId('E', ['E-01', 'E-09']) -> 'E-10'.
 */
export function nextId(prefix: string, existing: Iterable<string>, width = 2): string {
  let max = 0;
  const pattern = new RegExp(`^${prefix}-(\\d+)$`);
  for (const id of existing) {
    const m = pattern.exec(id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}-${String(max + 1).padStart(width, '0')}`;
}
