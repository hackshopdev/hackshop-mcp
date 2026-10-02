import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { DeviceEntry } from "../catalog/schema.js";
import { Platforms, type Platform } from "./schema.js";

const repoRoot = (): string => {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..", "..");
};

export function loadPlatforms(devices: DeviceEntry[]): Platform[] {
  const platformsPath = join(repoRoot(), "platforms.json");
  const raw = readFileSync(platformsPath, "utf8");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(
      `platforms.json is not valid JSON: ${(e as Error).message}\n` +
        `Path: ${platformsPath}`,
    );
  }

  const result = Platforms.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `platforms.json failed schema validation:\n${issues}\n` +
        `Path: ${platformsPath}`,
    );
  }

  assertPlatformInvariants(result.data, devices);
  return result.data;
}

export function assertPlatformInvariants(
  platforms: Platform[],
  devices: DeviceEntry[],
): void {
  const deviceIds = new Set(devices.map((device) => device.id));
  const taggedAgentDevices = new Set(
    devices
      .filter((device) => device.idea_fit_tags.includes("agent-gadget"))
      .map((device) => device.id),
  );
  const platformIds = new Set<string>();
  const platformDevicePairs = new Set<string>();
  const officialAgentDevices = new Set<string>();
  const violations: string[] = [];

  for (const platform of platforms) {
    if (platformIds.has(platform.id)) {
      violations.push(`  - duplicate platform id "${platform.id}"`);
    }
    platformIds.add(platform.id);

    const tierIds = new Set(platform.tiers.map((tier) => tier.id));
    for (const board of platform.boards) {
      const pairKey = `${platform.id}:${board.device_id}`;
      if (platformDevicePairs.has(pairKey)) {
        violations.push(
          `  - duplicate board pair "${board.device_id}" in platform "${platform.id}"`,
        );
      }
      platformDevicePairs.add(pairKey);

      if (!deviceIds.has(board.device_id)) {
        violations.push(
          `  - platform "${platform.id}" references unknown device "${board.device_id}"`,
        );
      }

      if (!tierIds.has(board.tier)) {
        violations.push(
          `  - board "${board.device_id}" uses unknown tier "${board.tier}" in platform "${platform.id}"`,
        );
      }

      if (board.support === "official") {
        officialAgentDevices.add(board.device_id);
      }
    }
  }

  for (const deviceId of officialAgentDevices) {
    if (!taggedAgentDevices.has(deviceId)) {
      violations.push(
        `  - official platform board "${deviceId}" is missing tag "agent-gadget"`,
      );
    }
  }

  for (const deviceId of taggedAgentDevices) {
    if (!officialAgentDevices.has(deviceId)) {
      violations.push(
        `  - device "${deviceId}" has tag "agent-gadget" but is not an official platform board`,
      );
    }
  }

  if (violations.length > 0) {
    throw new Error(
      `Platform invariant violation:\n${violations.join("\n")}\n\n` +
        `Fix: keep platforms.json, catalog.json and tags.md in sync.`,
    );
  }
}
