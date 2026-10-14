import { discoveryJson, readDiscoveryBody, requireDiscoveryReviewer, requireSameOrigin } from "../../../../lib/discoveries/auth";
import { discoveryError } from "../../../../lib/discoveries/http";
import { intakeDiscovery, listDiscoveryInbox } from "../../../../lib/discoveries/store";
import { IntakeRequest } from "../../../../lib/discoveries/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const reviewer = await requireDiscoveryReviewer(); if (reviewer instanceof Response) return reviewer;
  try { return discoveryJson(await listDiscoveryInbox()); } catch (error) { return discoveryError(error); }
}
export async function POST(request: Request) {
  const reviewer = await requireDiscoveryReviewer(); if (reviewer instanceof Response) return reviewer;
  const origin = requireSameOrigin(request); if (origin) return origin;
  try {
    const input = IntakeRequest.safeParse(await readDiscoveryBody(request));
    if (!input.success) return discoveryJson({ error: "invalid_input" }, 400);
    return discoveryJson({ candidate: await intakeDiscovery(input.data.url, reviewer.userId) }, 201);
  } catch (error) { return discoveryError(error); }
}
