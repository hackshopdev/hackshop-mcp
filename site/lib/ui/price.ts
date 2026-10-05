// One way to show a board price next to the all-in total (UX-005):
//   "Board $55-61 · about $63 with cable/parts"

/** "$55-61", "$36" from a catalog price range; null when unknown. */
export function boardPriceRange(min?: number | null, max?: number | null): string | null {
  const low = min ?? undefined;
  const high = max ?? undefined;
  if (low === undefined && high === undefined) return null;
  if (low !== undefined && high !== undefined && low !== high) return `$${round(low)}-${round(high)}`;
  return `$${round((low ?? high) as number)}`;
}

/**
 * Board price plus the estimated total with the cable and other required
 * parts. `board` accepts a range label ("$55-61", "~$36") or null.
 */
export function boardAndTotalLabel(board: string | null | undefined, total: number | null | undefined): string | null {
  const range = normalizeRange(board);
  const totalUsd = typeof total === "number" && Number.isFinite(total) ? Math.round(total) : null;
  if (!range) return totalUsd !== null ? `About $${totalUsd} with cable/parts` : null;
  if (totalUsd === null || totalUsd <= maxOf(range)) return `Board ${range}`;
  return `Board ${range} · about $${totalUsd} with cable/parts`;
}

function normalizeRange(label: string | null | undefined): string | null {
  if (!label) return null;
  const cleaned = label.trim().replace(/^~\s*/, "").replace(/^about\s+/i, "");
  return /^\$\d/.test(cleaned) ? cleaned : null;
}

function maxOf(range: string): number {
  const numbers = range.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  return numbers.length > 0 ? Math.max(...numbers) : 0;
}

function round(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}
