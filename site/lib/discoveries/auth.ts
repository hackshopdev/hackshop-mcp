import "server-only";
import { auth } from "@clerk/nextjs/server";
import { timingSafeEqual } from "node:crypto";

export function discoveryJson(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
export async function requireDiscoveryReviewer(): Promise<{ userId: string } | Response> {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return discoveryJson({ error: "auth_unavailable" }, 503);
  try {
    const { userId } = await auth();
    if (!userId) return discoveryJson({ error: "sign_in_required" }, 401);
    const allowed = (process.env.DISCOVERY_REVIEWER_IDS ?? "").split(/[\s,]+/).filter(Boolean);
    if (allowed.length === 0) return discoveryJson({ error: "reviewer_access_unconfigured" }, 503);
    if (!allowed.includes(userId)) return discoveryJson({ error: "reviewer_required" }, 403);
    return { userId };
  } catch { return discoveryJson({ error: "auth_unavailable" }, 503); }
}
export function requireDiscoveryWorker(request: Request): Response | null {
  const expected = process.env.DISCOVERY_WORKER_TOKEN;
  if (!expected || expected.length < 32) return discoveryJson({ error: "worker_unconfigured" }, 503);
  const supplied = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1] ?? "";
  const a = Buffer.from(expected); const b = Buffer.from(supplied);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return discoveryJson({ error: "unauthorized" }, 401);
  return null;
}
export function requireSameOrigin(request: Request): Response | null {
  if (request.headers.get("origin") !== new URL(request.url).origin ||
      request.headers.get("sec-fetch-site") === "cross-site")
    return discoveryJson({ error: "same_origin_required" }, 403);
  return null;
}
export async function readDiscoveryBody(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length") ?? 0) > 128000) throw new Error("body_too_large");
  const body = await request.text();
  if (Buffer.byteLength(body) > 128000) throw new Error("body_too_large");
  try { return JSON.parse(body); } catch { throw new Error("invalid_json"); }
}
