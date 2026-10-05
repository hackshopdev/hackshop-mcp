import { NextResponse } from "next/server";
import { ideasJson, requireIdeasUser } from "../../../lib/ideas/auth";
import { ideaBoard } from "../../../lib/ideas/boards";
import { moderateIdea } from "../../../lib/ideas/moderation";
import { notifyNewIdea } from "../../../lib/ideas/notify";
import {
  clientIp,
  createRateLimiter,
  HOUR_MS,
  LIST_PER_10_MIN,
  SUBMITS_PER_HOUR,
} from "../../../lib/ideas/rate-limit";
import { listIdeas, userIdeasClient } from "../../../lib/ideas/store";
import { suggestDeviceId } from "../../../lib/ideas/suggest";
import { isIdeaSort, isUuid, type PublicIdea } from "../../../lib/ideas/types";
import { parseIdeaSubmission } from "../../../lib/ideas/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const listLimiter = createRateLimiter(LIST_PER_10_MIN, 10 * 60 * 1000);
const submitLimiter = createRateLimiter(SUBMITS_PER_HOUR, HOUR_MS);

/** GET /api/ideas?sort=top|new&limit=50: public list of published ideas. */
export async function GET(request: Request) {
  if (!listLimiter.take(clientIp(request))) {
    return ideasJson({ error: "rate_limited" }, 429);
  }
  const url = new URL(request.url);
  const sortParam = url.searchParams.get("sort");
  const sort = isIdeaSort(sortParam) ? sortParam : "top";
  const limitParam = Number(url.searchParams.get("limit") ?? "50");
  const { ideas, source } = await listIdeas({
    sort,
    limit: Number.isFinite(limitParam) ? limitParam : 50,
  });
  return ideasJson(
    { ideas, sort, source },
    200,
    source === "live"
      ? { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=60" }
      : { "Cache-Control": "no-store" },
  );
}

/** POST /api/ideas: signed in only. Returns the public idea. */
export async function POST(request: Request) {
  const user = await requireIdeasUser();
  if (user instanceof NextResponse) return user;

  if (!submitLimiter.take(user.userId)) {
    return ideasJson({ error: "rate_limited" }, 429);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return ideasJson({ error: "invalid_json" }, 400);
  }

  const parsed = parseIdeaSubmission(body);
  if (!parsed.ok) {
    return ideasJson({ error: parsed.error, field: parsed.field, message: parsed.message }, 400);
  }
  const input = parsed.data;

  const moderation = moderateIdea(input);
  if (!moderation.ok) {
    return ideasJson({ error: moderation.error, field: moderation.field }, 400);
  }

  const suggested = suggestDeviceId(input);

  let id: string;
  let token: string;
  try {
    const { data, error } = await userIdeasClient(user.getToken).rpc("submit_idea", {
      p_title: input.title,
      p_body: input.body,
      p_display_name: input.display_name,
      p_size: input.size,
      p_interaction: input.interaction,
      p_sensing: input.sensing,
      p_budget: input.budget,
      p_suggested_device_id: suggested,
    });
    if (error) {
      const message = `${error.message ?? ""} ${(error as { code?: string }).code ?? ""}`;
      if (/daily_limit/.test(message)) return ideasJson({ error: "daily_limit" }, 429);
      if (/sign_in_required|28000|PGRST30[0-3]/.test(message)) {
        return ideasJson({ error: "sign_in_required" }, 401);
      }
      console.error(`[ideas] submit_idea failed: ${error.message}`);
      return ideasJson({ error: "submit_failed" }, 500);
    }
    const row = (Array.isArray(data) ? data[0] : data) as
      | { id?: unknown; moderation_token?: unknown }
      | null
      | undefined;
    if (!row || !isUuid(row.id) || !isUuid(row.moderation_token)) {
      console.error("[ideas] submit_idea returned no id");
      return ideasJson({ error: "submit_failed" }, 500);
    }
    id = row.id;
    token = row.moderation_token;
  } catch (err) {
    console.error(`[ideas] submit_idea error: ${(err as Error).message}`);
    return ideasJson({ error: "submit_failed" }, 500);
  }

  const idea: PublicIdea = {
    id,
    display_name: input.display_name,
    title: input.title,
    body: input.body,
    size: input.size,
    interaction: input.interaction,
    sensing: input.sensing,
    budget: input.budget,
    suggested_device_id: suggested,
    vote_count: 0,
    created_at: new Date().toISOString(),
  };

  // The idea is saved; email problems are logged inside and never fail this.
  try {
    await notifyNewIdea(idea, token, ideaBoard(suggested)?.name ?? null);
  } catch {
    // ignore
  }

  return ideasJson({ idea }, 201);
}
