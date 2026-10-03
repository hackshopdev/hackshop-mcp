import { z } from "zod";
import { buildPlan } from "../build-plan/index.js";
import type { BuildPlan } from "../build-plan/types.js";
import type { DeviceEntry } from "../catalog/schema.js";
import { printablesFor } from "../platforms/index.js";
import type { Platform, PlatformBoard } from "../platforms/schema.js";

export const getBuildPlanInput = z.object({
  device_id: z.string().min(1).max(200),
});

export type GetBuildPlanInput = z.infer<typeof getBuildPlanInput>;

export function getBuildPlan(
  input: GetBuildPlanInput,
  catalog: DeviceEntry[],
  platforms: Platform[],
  siteUrl: string,
): BuildPlan {
  const device = catalog.find((candidate) => candidate.id === input.device_id);
  if (!device) {
    throw new Error(`404: device "${input.device_id}" is not in the catalog`);
  }

  const { platform, board } = platformAndBoardFor(device.id, platforms);
  return buildPlan({
    device,
    platform,
    board,
    printables: printablesFor(device, siteUrl),
    siteUrl,
  });
}

function platformAndBoardFor(
  deviceId: string,
  platforms: Platform[],
): { platform: Platform | null; board: PlatformBoard | null } {
  for (const platform of platforms) {
    const board = platform.boards.find((candidate) => candidate.device_id === deviceId);
    if (board) return { platform, board };
  }
  return { platform: null, board: null };
}
