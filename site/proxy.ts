import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { clerkEnabled } from "./lib/auth-config";
import {
  anonymousRequestId,
  captureServerEvent,
  classifyUserAgent,
} from "./lib/serverAnalytics";

// Agent-discovery files are static and never run our analytics JS, so this is
// the only place their traffic is visible.
function trackAgentFile(request: NextRequest, event: NextFetchEvent): void {
  const path = request.nextUrl.pathname;
  if (
    path !== "/llms.txt" &&
    path !== "/agents.md" &&
    !path.startsWith("/.well-known/")
  ) {
    return;
  }

  event.waitUntil(
    captureServerEvent({
      event: "agent_file_requested",
      distinctId: anonymousRequestId(request),
      properties: {
        path,
        client_family: classifyUserAgent(request.headers.get("user-agent")),
        surface: "agent_files",
      },
    }),
  );
}

function agentFileProxy(request: NextRequest, event: NextFetchEvent) {
  trackAgentFile(request, event);
  return NextResponse.next();
}

const clerkProxy = clerkMiddleware((_auth, request, event) => {
  trackAgentFile(request, event);
  return NextResponse.next();
});

export const proxy = clerkEnabled ? clerkProxy : agentFileProxy;

export const config = {
  matcher: [
    "/llms.txt",
    "/agents.md",
    "/.well-known/:path*",
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
