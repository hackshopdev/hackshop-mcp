import { after } from "next/server";
import { z } from "zod";
import { captureServerEvent } from "@/lib/serverAnalytics";

export const runtime = "nodejs";

// Receives anonymous usage pings from the hackshop-mcp npm package
// (src/telemetry.ts). The MCP server runs on users' machines over stdio, so
// this is the only way to see it being used. Payload is metadata only: tool
// name, timing, success, versions. Never idea text or tool arguments.

const shortText = z.string().trim().max(80);

const telemetryEvent = z.object({
  event: z.enum(["mcp_server_started", "mcp_tool_called"]),
  install_id: z.string().uuid(),
  mcp_version: shortText,
  client_name: shortText.optional(),
  client_version: shortText.optional(),
  client_sampling: z.boolean().optional(),
  tool: z
    .enum(["propose_hardware", "assess_hackability", "simulate_assembly", "unknown"])
    .optional(),
  success: z.boolean().optional(),
  degraded: z.boolean().optional(),
  error_kind: shortText.optional(),
  duration_ms: z.number().int().min(0).max(600_000).optional(),
  platform: shortText.optional(),
  node_version: shortText.optional(),
});

const RATE_LIMIT = 600;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const MAX_BUCKETS = 10_000;
const buckets = new Map<string, { count: number; resetAt: number }>();

function allow(ip: string): boolean {
  const now = Date.now();
  if (buckets.size >= MAX_BUCKETS) {
    for (const [key, b] of buckets) if (b.resetAt < now) buckets.delete(key);
  }
  const b = buckets.get(ip);
  if (!b || b.resetAt < now) {
    buckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  b.count += 1;
  return b.count <= RATE_LIMIT;
}

export async function POST(req: Request): Promise<Response> {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  if (!allow(ip)) return new Response(null, { status: 429 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  const parsed = telemetryEvent.safeParse(body);
  if (!parsed.success) return new Response(null, { status: 400 });

  const { event, install_id, ...properties } = parsed.data;
  after(() =>
    captureServerEvent({
      event,
      distinctId: `mcp_${install_id}`,
      properties: { ...properties, surface: "mcp" },
    }),
  );
  return new Response(null, { status: 204 });
}
