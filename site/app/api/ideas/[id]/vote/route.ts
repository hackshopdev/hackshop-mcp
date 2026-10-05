import { NextResponse } from "next/server";
import { ideasJson, requireIdeasUser } from "../../../../../lib/ideas/auth";
import { createRateLimiter, HOUR_MS, VOTES_PER_HOUR } from "../../../../../lib/ideas/rate-limit";
import { userIdeasClient } from "../../../../../lib/ideas/store";
import { isUuid } from "../../../../../lib/ideas/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// 200 vote changes (adds and removes) per hour per user.
const voteLimiter = createRateLimiter(VOTES_PER_HOUR, HOUR_MS);

/** POST /api/ideas/<id>/vote: add the signed-in user's vote. */
export async function POST(_request: Request, context: RouteContext) {
  return changeVote(context, true);
}

/** DELETE /api/ideas/<id>/vote: remove it. */
export async function DELETE(_request: Request, context: RouteContext) {
  return changeVote(context, false);
}

async function changeVote(context: RouteContext, add: boolean) {
  const user = await requireIdeasUser();
  if (user instanceof NextResponse) return user;

  if (!voteLimiter.take(user.userId)) {
    return ideasJson({ error: "rate_limited" }, 429);
  }

  const { id } = await context.params;
  if (!isUuid(id)) return ideasJson({ error: "not_found" }, 404);

  const supabase = userIdeasClient(user.getToken);
  try {
    if (add) {
      const { error } = await supabase
        .from("idea_votes")
        .insert({ idea_id: id, user_id: user.userId });
      // 23505: already voted, which is fine. 42501/23503: RLS refused it
      // (hidden or missing idea) or the idea does not exist.
      if (error && error.code !== "23505") {
        if (error.code === "42501" || error.code === "23503") {
          return ideasJson({ error: "not_found" }, 404);
        }
        throw new Error(error.message);
      }
    } else {
      const { error } = await supabase
        .from("idea_votes")
        .delete()
        .eq("idea_id", id)
        .eq("user_id", user.userId);
      if (error) throw new Error(error.message);
    }
    return ideasJson({ voted: add, vote_count: await currentCount(supabase, id) });
  } catch (err) {
    console.error(`[ideas] vote failed: ${(err as Error).message}`);
    return ideasJson({ error: "vote_failed" }, 500);
  }
}

async function currentCount(
  supabase: ReturnType<typeof userIdeasClient>,
  id: string,
): Promise<number | null> {
  const { data, error } = await supabase
    .from("ideas")
    .select("vote_count")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const count = Number((data as { vote_count?: unknown }).vote_count);
  return Number.isFinite(count) ? count : null;
}
