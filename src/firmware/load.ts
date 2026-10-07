import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FirmwarePlaybookCatalog, type FirmwarePlaybook } from "../core/firmware.js";

export function loadFirmwarePlaybooks(): FirmwarePlaybook[] {
  const here = dirname(fileURLToPath(import.meta.url));
  const path = join(here, "..", "..", "firmware-playbooks.json");
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`firmware-playbooks.json could not be read: ${(error as Error).message}\nPath: ${path}`);
  }
  const result = FirmwarePlaybookCatalog.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`firmware-playbooks.json failed schema validation:\n${issues}\nPath: ${path}`);
  }
  return result.data;
}
