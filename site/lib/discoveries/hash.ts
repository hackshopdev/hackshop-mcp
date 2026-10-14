import { createHash } from "node:crypto";

/** Stable JSON for comparing published records across object-key order changes. */
export function canonicalJson(value: unknown): string {
  const ordered = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(ordered);
    if (item && typeof item === "object") {
      return Object.fromEntries(Object.entries(item).filter(([, child]) => child !== undefined)
        .sort(([left], [right]) => left.localeCompare(right, "en"))
        .map(([key, child]) => [key, ordered(child)]));
    }
    return item;
  };
  return JSON.stringify(ordered(value));
}
export function hashDiscoveryRecord(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}
