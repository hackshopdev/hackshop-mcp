import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Platforms, type Platform } from "./platform-types";

let cached: Platform[] | null = null;

export function loadPlatforms(): Platform[] {
  if (cached) return cached;

  const root = process.cwd();
  const raw = readFileSync(join(root, "platforms.json"), "utf8");
  const parsed = Platforms.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error(`platforms.json invalid: ${parsed.error.message}`);
  }

  cached = parsed.data;
  return cached;
}
