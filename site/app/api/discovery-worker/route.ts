import { discoveryJson, readDiscoveryBody, requireDiscoveryWorker } from "../../../lib/discoveries/auth";
import { discoveryError } from "../../../lib/discoveries/http";
import { discoveryWorker } from "../../../lib/discoveries/store";
import { WorkerRequest } from "../../../lib/discoveries/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const denied = requireDiscoveryWorker(request); if (denied) return denied;
  try {
    const input = WorkerRequest.safeParse(await readDiscoveryBody(request));
    if (!input.success) return discoveryJson({ error: "invalid_input" }, 400);
    return discoveryJson(await discoveryWorker(input.data));
  } catch (error) { return discoveryError(error); }
}
