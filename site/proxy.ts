import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import {
  anonymousRequestId,
  captureServerEvent,
  classifyUserAgent,
} from "./lib/serverAnalytics";

// Agent-discovery files are static and never run our analytics JS, so this is
// the only place their traffic is visible. Scoped by `matcher` to those files;
// every other request skips the proxy entirely.
export function proxy(request: NextRequest, event: NextFetchEvent) {
  event.waitUntil(
    captureServerEvent({
      event: "agent_file_requested",
      distinctId: anonymousRequestId(request),
      properties: {
        path: request.nextUrl.pathname,
        client_family: classifyUserAgent(request.headers.get("user-agent")),
        surface: "agent_files",
      },
    }),
  );
  return NextResponse.next();
}

export const config = {
  matcher: ["/llms.txt", "/agents.md", "/.well-known/:path*"],
};
