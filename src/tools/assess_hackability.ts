import type { DeviceEntry } from "../catalog/schema.js";
import { getLoadedPlatforms, printablesFor } from "../platforms/index.js";
import { siteUrlFromEnv } from "../site-url.js";
import {
  assessHackability as assessHackabilityCore,
  assessHackabilityInput,
  type AssessInput,
  type AssessOutput,
} from "../core/assess.js";

export { assessHackabilityInput, type AssessInput, type AssessOutput };

export function assessHackability(
  input: AssessInput,
  catalog: DeviceEntry[],
): AssessOutput {
  const siteUrl = siteUrlFromEnv();
  return assessHackabilityCore(input, {
    catalog,
    platforms: getLoadedPlatforms(),
    printablesFor: (device, baseUrl) => printablesFor(device as DeviceEntry, baseUrl),
    siteUrl,
  });
}
