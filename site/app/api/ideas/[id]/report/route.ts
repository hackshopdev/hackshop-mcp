import { NextResponse } from "next/server";
import { ideasJson, requireIdeasUser } from "../../../../../lib/ideas/auth";
import { createRateLimiter, HOUR_MS, REPORTS_PER_HOUR } from "../../../../../lib/ideas/rate-limit";
import { userIdeasClient } from "../../../../../lib/ideas/store";
import { isUuid } from "../../../../../lib/ideas/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const reportLimiter = createRateLimiter(REPORTS_PER_HOUR, HOUR_MS);

/**
 * POST /api/ideas/<id>/report: signed in only. One report per user per idea
 * (repeat reports are accepted and ignored); 3 reports hide the idea.
 */
export async function POST(_request: Request, context: RouteContext) {
  const user = await requireIdeasUser();
  if (user instanceof NextResponse) return user;

  if (!reportLimiter.take(user.userId)) {
    return ideasJson({ error: "rate_limited" }, 429);
  }

  const { id } = await context.params;
  if (!isUuid(id)) return ideasJson({ error: "not_found" }, 404);

  try {
    const { error } = await userIdeasClient(user.getToken).rpc("report_idea", { p_id: id });
    if (error) throw new Error(error.message);
    return ideasJson({ ok: true });
  } catch (err) {
    console.error(`[ideas] report failed: ${(err as Error).message}`);
    return ideasJson({ error: "report_failed" }, 500);
  }
}
