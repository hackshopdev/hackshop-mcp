import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { loadCoreContext } from "../../lib/mcp/context";
import { createHostedMcpServer } from "../../lib/mcp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 300;
const hits = new Map<string, { count: number; resetAt: number }>();

export async function POST(request: Request) {
  if (!allowRequest(request)) return rateLimitResponse();
  const server = createHostedMcpServer(loadCoreContext(), request);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return noStore(await transport.handleRequest(request));
}

export async function DELETE(request: Request) {
  if (!allowRequest(request)) return rateLimitResponse();
  const server = createHostedMcpServer(loadCoreContext(), request);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return noStore(await transport.handleRequest(request));
}

export async function GET(request: Request) {
  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    return new Response(
      "<!doctype html><html><head><title>Hackshop MCP</title></head><body><main><h1>Hackshop MCP</h1><p>Add this connector at <code>https://www.hackshop.dev/mcp</code>. Use <code>plan_gadget</code> for Muse agent bodies, then <code>get_build_plan</code> for shopping, assembly, flashing and pairing. Hackshop never buys anything without human approval.</p><p><a href=\"/#use-with-your-agent\">Use with your agent</a></p></main></body></html>",
      {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      },
    );
  }

  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32000, message: "GET is not supported for stateless MCP JSON-RPC. Use POST." },
    }),
    {
      status: 405,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        Allow: "POST, DELETE, GET",
      },
    },
  );
}

function noStore(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function rateLimitResponse(): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32000, message: "Rate limit exceeded. Try again later." },
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    },
  );
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
