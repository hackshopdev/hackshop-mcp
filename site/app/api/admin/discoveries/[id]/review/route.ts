import { discoveryJson, readDiscoveryBody, requireDiscoveryReviewer, requireSameOrigin } from "../../../../../../lib/discoveries/auth";
import { discoveryError } from "../../../../../../lib/discoveries/http";
import { reviewDiscovery } from "../../../../../../lib/discoveries/store";
import { Id, ReviewRequest } from "../../../../../../lib/discoveries/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const reviewer = await requireDiscoveryReviewer(); if (reviewer instanceof Response) return reviewer;
  const origin = requireSameOrigin(request); if (origin) return origin;
  const { id } = await context.params; if (!Id.safeParse(id).success) return discoveryJson({ error: "not_found" }, 404);
  try {
    const input = ReviewRequest.safeParse(await readDiscoveryBody(request));
    if (!input.success) return discoveryJson({ error: "invalid_input" }, 400);
    return discoveryJson({ candidate: await reviewDiscovery(id, reviewer.userId, input.data) });
  } catch (error) { return discoveryError(error); }
}
