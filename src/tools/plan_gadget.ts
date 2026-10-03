import type { DeviceEntry } from "../catalog/schema.js";
import { getLoadedPlatforms, printablesFor } from "../platforms/index.js";
import type { Platform } from "../platforms/schema.js";
import { siteUrlFromEnv } from "../site-url.js";
import {
  NEED_VALUES,
  planGadget as planGadgetCore,
  planGadgetInput,
  type Need,
  type PlanGadgetInput,
  type PlanGadgetOutput,
  type Size,
} from "../core/plan-gadget.js";
import type {
  DeviceEntry as CoreDeviceEntry,
  Platform as CorePlatform,
} from "../core/types.js";

export { NEED_VALUES, planGadgetInput, type Need, type PlanGadgetInput, type PlanGadgetOutput, type Size };

type _DeviceEntryAssignableToCore = DeviceEntry extends CoreDeviceEntry ? true : never;
type _PlatformAssignableToCore = Platform extends CorePlatform ? true : never;

export function planGadget(
  input: PlanGadgetInput,
  catalog: DeviceEntry[],
): PlanGadgetOutput {
  const siteUrl = siteUrlFromEnv();
  return planGadgetCore(input, {
    catalog,
    platforms: getLoadedPlatforms(),
    printablesFor: (device, baseUrl) => printablesFor(device as DeviceEntry, baseUrl),
    siteUrl,
  });
}
