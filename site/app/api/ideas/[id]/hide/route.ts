import { anonIdeasClient } from "../../../../../lib/ideas/store";
import { clientIp, createRateLimiter, HIDES_PER_HOUR, HOUR_MS } from "../../../../../lib/ideas/rate-limit";
import { isUuid } from "../../../../../lib/ideas/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const hideLimiter = createRateLimiter(HIDES_PER_HOUR, HOUR_MS);

/**
 * GET /api/ideas/<id>/hide?token=<moderation_token>: the one-click link in
 * the new-idea email. The token is the secret, so no sign-in is needed.
 */
export async function GET(request: Request, context: RouteContext) {
  if (!hideLimiter.take(clientIp(request))) {
    return page(429, "Too many requests", "Wait a few minutes and open the link again.");
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
    return page(500, "Could not hide the idea", "Something went wrong. Try the link again in a minute.");
  }
}

function page(status: number, title: string, message: string): Response {
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
</style>
</head>
<body>
<main>
<h1>${title}</h1>
<p>${message}</p>
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
