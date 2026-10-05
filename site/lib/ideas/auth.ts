import "server-only";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { clerkEnabled } from "../auth-config";

export type IdeasUser = { userId: string; getToken: () => Promise<string | null> };

export function ideasJson(body: unknown, status = 200, headers?: HeadersInit): NextResponse {
  const merged = new Headers(headers);
  if (!merged.has("Cache-Control")) merged.set("Cache-Control", "no-store");
  return NextResponse.json(body, { status, headers: merged });
}

/** Signed-in Clerk user, or a 401 `{ error: "sign_in_required" }`. */
export async function requireIdeasUser(): Promise<IdeasUser | NextResponse> {
  if (!clerkEnabled) return ideasJson({ error: "sign_in_required" }, 401);
  try {
    const { userId, getToken } = await auth();
    if (!userId) return ideasJson({ error: "sign_in_required" }, 401);
    return { userId, getToken: () => getToken() };
  } catch {
    return ideasJson({ error: "sign_in_required" }, 401);
  }
}
