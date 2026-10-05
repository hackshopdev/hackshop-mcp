import { anonIdeasClient } from "../../../../../lib/ideas/store";
import { clientIp, createRateLimiter, HIDES_PER_HOUR, HOUR_MS } from "../../../../../lib/ideas/rate-limit";
import { isUuid } from "../../../../../lib/ideas/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const hideLimiter = createRateLimiter(HIDES_PER_HOUR, HOUR_MS);

/**
 * GET /api/ideas/<id>/hide?token=<moderation_token>: the link in the
 * new-idea email. It only shows a confirm button, so email link scanners
 * that open links on their own can't hide anything. The POST does the work.
 */
export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const token = new URL(request.url).searchParams.get("token");
  if (!isUuid(id) || !isUuid(token)) {
    return page(400, "Link not valid", "This hide link is missing a part. Open it from the email again.");
  }
  const action = `/api/ideas/${id}/hide?token=${encodeURIComponent(token)}`;
  return page(
    200,
    "Hide this idea?",
    "It will stop showing on hackshop.dev/ideas.",
    `<form method="post" action="${action}"><button type="submit">Hide this idea</button></form>`,
  );
}

/** POST /api/ideas/<id>/hide?token=: hides the idea when the token matches. */
export async function POST(request: Request, context: RouteContext) {
  if (!hideLimiter.take(clientIp(request))) {
    return page(429, "Too many requests", "Wait a few minutes and try again.");
  }

  const { id } = await context.params;
  const token = new URL(request.url).searchParams.get("token");
  if (!isUuid(id) || !isUuid(token)) {
    return page(400, "Link not valid", "This hide link is missing a part. Open it from the email again.");
  }

  try {
    const { data, error } = await anonIdeasClient().rpc("hide_idea", { p_id: id, p_token: token });
    if (error) throw new Error(error.message);
    if (data !== true) {
      return page(404, "Link not valid", "The token does not match this idea, or the idea is gone.");
    }
    return page(200, "Idea hidden", "It no longer shows on hackshop.dev/ideas.");
  } catch (err) {
    console.error(`[ideas] hide failed: ${(err as Error).message}`);
    return page(500, "Could not hide the idea", "Something went wrong. Try again in a minute.");
  }
}

function page(status: number, title: string, message: string, extra = ""): Response {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>${title} · hackshop</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #0a0a0a; color: #f4f4f2; font: 17px/1.6 system-ui, sans-serif; }
  main { max-width: 420px; padding: 24px; }
  h1 { margin: 0 0 8px; font-size: 24px; }
  p { margin: 0 0 16px; color: #9a9a95; }
  a { color: #ff7a00; }
  button { font: inherit; font-weight: 600; padding: 10px 18px; border: 0; border-radius: 10px; background: #ff7a00; color: #0a0a0a; cursor: pointer; margin-bottom: 16px; }
</style>
</head>
<body>
<main>
<h1>${title}</h1>
<p>${message}</p>
${extra}
<p><a href="https://www.hackshop.dev/ideas">Back to ideas</a></p>
</main>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
