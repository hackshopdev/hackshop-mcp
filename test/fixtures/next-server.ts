// Minimal stand-in for next/server so root tests don't need site/node_modules
// (CI installs only the root package). Covers what the API routes use.
export class NextResponse extends Response {
  static json(body: unknown, init?: ResponseInit): NextResponse {
    const headers = new Headers(init?.headers);
    if (!headers.has("content-type")) headers.set("content-type", "application/json");
    return new NextResponse(JSON.stringify(body), { ...init, headers });
  }

  static next(): NextResponse {
    return new NextResponse(null, { status: 200 });
  }
}

export type NextRequest = Request & { nextUrl: URL };
export type NextFetchEvent = { waitUntil(promise: Promise<unknown>): void };
