import { NextResponse } from "next/server";
import { ideasJson, requireIdeasUser } from "../../../../lib/ideas/auth";
import { userIdeasClient } from "../../../../lib/ideas/store";
import { isUuid } from "../../../../lib/ideas/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/ideas/votes: the signed-in user's voted idea ids. */
export async function GET() {
  const user = await requireIdeasUser();
  if (user instanceof NextResponse) return user;

  try {
    const { data, error } = await userIdeasClient(user.getToken)
      .from("idea_votes")
      .select("idea_id")
      .eq("user_id", user.userId)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    const ideaIds = (Array.isArray(data) ? data : [])
      .map((row) => (row as { idea_id?: unknown }).idea_id)
      .filter(isUuid);
    return ideasJson({ idea_ids: ideaIds });
  } catch (err) {
    console.error(`[ideas] votes list failed: ${(err as Error).message}`);
    return ideasJson({ error: "votes_unavailable" }, 503);
  }
}
