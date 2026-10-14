import { discoveryJson, readDiscoveryBody, requireDiscoveryReviewer, requireSameOrigin } from "../../../../../lib/discoveries/auth";
import { discoveryError } from "../../../../../lib/discoveries/http";
import { getDiscoveryCandidate, reviewDiscovery } from "../../../../../lib/discoveries/store";
import { EditRequest, Id } from "../../../../../lib/discoveries/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  const reviewer = await requireDiscoveryReviewer(); if (reviewer instanceof Response) return reviewer;
  const { id } = await context.params; if (!Id.safeParse(id).success) return discoveryJson({ error: "not_found" }, 404);
  try { return discoveryJson({ candidate: await getDiscoveryCandidate(id) }); } catch (error) { return discoveryError(error); }
}
export async function PATCH(request: Request, context: Context) {
  const reviewer = await requireDiscoveryReviewer(); if (reviewer instanceof Response) return reviewer;
  const origin = requireSameOrigin(request); if (origin) return origin;
  const { id } = await context.params; if (!Id.safeParse(id).success) return discoveryJson({ error: "not_found" }, 404);
  try {
    const input = EditRequest.safeParse(await readDiscoveryBody(request));
    if (!input.success) {
      const resolutionError = input.error.issues.some((issue) => issue.path[0] === "resolved_claims");
      return discoveryJson({ error: resolutionError ? "invalid_resolution" : "invalid_input" }, resolutionError ? 422 : 400);
    }
    return discoveryJson({ candidate: await reviewDiscovery(id, reviewer.userId, { ...input.data, action: "edit" }) });
  } catch (error) { return discoveryError(error); }
}
