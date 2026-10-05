import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { loadCoreContext } from "../../lib/mcp/context";
import { createHostedMcpServer } from "../../lib/mcp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 300;
const hits = new Map<string, { count: number; resetAt: number }>();

// The hosted MCP is stateless JSON-RPC over POST. It never issues an
// mcp-session-id, so there is no SSE stream to GET and no session to DELETE.
const ALLOW = "POST, OPTIONS";

// Public endpoint for browser-based agents: any origin may call it.
const CORS_HEADERS: Readonly<Record<string, string>> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, accept, mcp-session-id, mcp-protocol-version, authorization",
  "Access-Control-Expose-Headers": "mcp-session-id",
  "Access-Control-Max-Age": "86400",
};

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { ...CORS_HEADERS, Allow: ALLOW, "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  if (!allowRequest(request)) return rateLimitResponse();
  const server = createHostedMcpServer(loadCoreContext(), request);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return withHeaders(await transport.handleRequest(request));
}

export async function DELETE() {
  return methodNotAllowed(
    "DELETE is not supported: this MCP server is stateless and has no sessions to end. Use POST.",
  );
}

export async function GET(request: Request) {
  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    return new Response(
      "<!doctype html><html><head><title>hackshop MCP</title></head><body><main><h1>hackshop MCP</h1><p>Add this connector at <code>https://www.hackshop.dev/mcp</code>. It is stateless: send JSON-RPC with POST. Start with <code>intake_gadget</code>, then <code>plan_gadget</code> for Muse agent bodies and <code>get_build_plan</code> for shopping, assembly, flashing and pairing. hackshop never buys anything; your agent asks before every order.</p><p><a href=\"/#use-with-your-agent\">Use with your agent</a></p></main></body></html>",
      {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      },
    );
  }

  return methodNotAllowed(
    "GET is not supported: this MCP server is stateless JSON-RPC with no SSE stream. Use POST.",
  );
}

function methodNotAllowed(message: string): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32000, message },
    }),
    {
      status: 405,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        Allow: ALLOW,
      },
    },
  );
}

function withHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store");
  for (const [name, value] of Object.entries(CORS_HEADERS)) headers.set(name, value);
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
        ...CORS_HEADERS,
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
