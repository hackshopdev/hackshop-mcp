import { discoveryJson } from "./auth";
import { DiscoveryStoreError } from "./store";
export function discoveryError(error: unknown): Response {
  if (error instanceof DiscoveryStoreError) return discoveryJson({ error: error.code }, error.status);
  if (error instanceof Error && ["invalid_json", "body_too_large"].includes(error.message))
    return discoveryJson({ error: error.message }, error.message === "body_too_large" ? 413 : 400);
  return discoveryJson({ error: "queue_unavailable" }, 503);
}
