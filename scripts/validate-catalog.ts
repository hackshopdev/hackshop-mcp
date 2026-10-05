#!/usr/bin/env tsx
// Validate catalog.json, tags.md and platforms.json without booting the full
// server. Run via `npm run validate`. Used in CI / pre-publish.

import { loadCatalog } from "../src/catalog/load.js";
import { loadPlatforms } from "../src/platforms/load.js";
import type { Platform } from "../src/platforms/schema.js";

const SDK_DOCS = "https://github.com/facebookincubator/muse-gadget-sdk/";

/** Data rules the schema can't express on its own. */
function platformDataProblems(platforms: Platform[]): string[] {
  const problems: string[] = [];
  for (const platform of platforms) {
    for (const board of platform.boards) {
      const where = `${platform.id}/${board.device_id}`;
      if (board.support === "official" && !board.difficulty) {
        problems.push(`${where}: official boards need a difficulty level`);
      }
      if (board.flash && !board.flash.source.startsWith(SDK_DOCS)) {
        problems.push(`${where}: flash overlay must cite the Muse Gadgets SDK docs (${SDK_DOCS})`);
      }
      if (board.flash && platform.sdk_path !== "esp32") {
        problems.push(`${where}: flash overlays only apply to ESP32 boards`);
      }
    }
  }
  return problems;
}

try {
  const { devices, tags } = loadCatalog();
  const platforms = loadPlatforms(devices);
  const problems = platformDataProblems(platforms);
  if (problems.length > 0) {
    throw new Error(`platforms.json data problems:\n${problems.map((problem) => `  - ${problem}`).join("\n")}`);
  }
  console.log(
    `OK: ${devices.length} devices, ${tags.size} tags, ${platforms.length} platforms, all schema-valid, no tag/platform drift.`,
  );
  process.exit(0);
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}
