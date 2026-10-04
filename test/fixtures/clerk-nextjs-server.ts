import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

type AuthResult = {
  userId: string | null;
  getToken: () => Promise<string | null>;
};

export async function auth(): Promise<AuthResult> {
  const mock = (globalThis as typeof globalThis & {
    __clerkAuthMock?: () => Promise<AuthResult> | AuthResult;
  }).__clerkAuthMock;
  if (mock) return await mock();
  return { userId: null, getToken: async () => null };
}

export function clerkMiddleware(
  handler?: (
    authObject: unknown,
    request: NextRequest,
    event: NextFetchEvent,
  ) => NextResponse | Response | void,
) {
  return (request: NextRequest, event: NextFetchEvent) =>
    handler?.({}, request, event) ?? NextResponse.next();
}

type CurrentUserResult = {
  primaryEmailAddress?: {
    emailAddress: string;
    verification?: { status: string } | null;
  } | null;
} | null;

export async function currentUser(): Promise<CurrentUserResult> {
  const mock = (globalThis as typeof globalThis & {
    __clerkCurrentUserMock?: () => Promise<CurrentUserResult> | CurrentUserResult;
  }).__clerkCurrentUserMock;
  if (mock) return await mock();
  return null;
}
