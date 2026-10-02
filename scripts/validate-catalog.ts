#!/usr/bin/env tsx
// Validate catalog.json + tags.md without booting the full server.
// Run via `npm run validate`. Used in CI / pre-publish.

import { loadCatalog } from "../src/catalog/load.js";
import { loadPlatforms } from "../src/platforms/load.js";

try {
  const { devices, tags } = loadCatalog();
  const platforms = loadPlatforms(devices);
  console.log(
    `OK: ${devices.length} devices, ${tags.size} tags, ${platforms.length} platforms, all schema-valid, no tag/platform drift.`,
  );
  process.exit(0);
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}
