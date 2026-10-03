import type { BuildPlan } from "../build-plan/types.js";
import type { DeviceEntry } from "../catalog/schema.js";
import { getBuildPlan as getBuildPlanCore, getBuildPlanInput, type GetBuildPlanInput } from "../core/tools.js";
import { printablesFor } from "../platforms/index.js";
import type { Platform } from "../platforms/schema.js";

export { getBuildPlanInput, type GetBuildPlanInput };

export function getBuildPlan(
  input: GetBuildPlanInput,
  catalog: DeviceEntry[],
  platforms: Platform[],
  siteUrl: string,
): BuildPlan {
  const result = getBuildPlanCore(input, {
    catalog,
    platforms,
    printablesFor: (device, baseUrl) => printablesFor(device as DeviceEntry, baseUrl),
    siteUrl,
  });
  if ("isError" in result) {
    throw new Error(result.text);
  }
  return result;
}
