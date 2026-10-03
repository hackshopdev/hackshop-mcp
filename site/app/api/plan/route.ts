import { NextResponse } from "next/server";
import { formatInputError } from "../../../lib/core/errors";
import { planGadget, planGadgetInput } from "../../../lib/core/plan-gadget";
import { anonymousRequestId, captureServerEvent } from "../../../lib/serverAnalytics";
import { loadCoreContext } from "../../../lib/mcp/context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 120;
const hits = new Map<string, { count: number; resetAt: number }>();

export async function GET(request: Request) {
  const url = new URL(request.url);
  const body: Record<string, unknown> = {
    idea: url.searchParams.get("idea") ?? "",
  };
  const budget = url.searchParams.get("budget_usd");
  if (budget !== null && budget !== "") body.budget_usd = Number(budget);
  return handlePlan(request, body);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400);
  }
  return handlePlan(request, body);
}

async function handlePlan(request: Request, body: unknown) {
  if (!allowRequest(request)) {
    return json({ error: "Rate limit exceeded. Try again later." }, 429);
  }

  const parsed = planGadgetInput.safeParse(body);
  if (!parsed.success) {
    return json({ error: formatInputError("plan_gadget", parsed.error) }, 400);
  }

  const output = planGadget(parsed.data, loadCoreContext());
  await captureServerEvent({
    event: "plan_requested",
    distinctId: anonymousRequestId(request),
    properties: {
      need_count: output.inferred_needs.length,
      fit: output.fit,
      pick_count: output.picks.length,
      has_budget: parsed.data.budget_usd !== undefined,
    },
  });
  return json(output, 200);
}

function json(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function allowRequest(request: Request): boolean {
  const now = Date.now();
  const key = clientIp(request);
  const current = hits.get(key);
  if (!current || current.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (current.count >= MAX_REQUESTS) return false;
  current.count += 1;
  return true;
}

function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
}
