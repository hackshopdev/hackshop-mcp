import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  clerkEnabled,
  supabasePublishableKey,
  supabaseUrl,
} from "../../../../lib/auth-config";
import {
  ProjectPatchSchema,
  ProjectSchema,
  type Project,
} from "../../../../lib/projects/types";

export const runtime = "nodejs";

type AuthState = { userId: string; getToken: () => Promise<string | null> };
type RouteContext = { params: Promise<{ id: string }> | { id: string } };

export async function GET(_request: Request, context: RouteContext) {
  const authState = await requireAuth();
  if (authState instanceof NextResponse) return authState;
  const { id } = await context.params;

  const supabase = supabaseFor(authState);
  const { data, error } = await supabase
    .from("build_projects")
    .select("*")
    .eq("id", id)
    .eq("user_id", authState.userId)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ project: rowToProject(data as Record<string, unknown>) });
}

export async function PATCH(request: Request, context: RouteContext) {
  const authState = await requireAuth();
  if (authState instanceof NextResponse) return authState;
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = ProjectPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const row = { ...parsed.data, updated_at: new Date().toISOString() };
  const supabase = supabaseFor(authState);
  const { data, error } = await supabase
    .from("build_projects")
    .update(row)
    .eq("id", id)
    .eq("user_id", authState.userId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ project: rowToProject(data as Record<string, unknown>) });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const authState = await requireAuth();
  if (authState instanceof NextResponse) return authState;
  const { id } = await context.params;

  const supabase = supabaseFor(authState);
  const { error } = await supabase
    .from("build_projects")
    .delete()
    .eq("id", id)
    .eq("user_id", authState.userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

async function requireAuth(): Promise<AuthState | NextResponse> {
  if (!clerkEnabled) {
    return NextResponse.json({ error: "sync_disabled" }, { status: 503 });
  }
  const { userId, getToken } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return { userId, getToken };
}

function supabaseFor(authState: AuthState) {
  return createClient(supabaseUrl, supabasePublishableKey, {
    accessToken: async () => (await authState.getToken()) ?? null,
    auth: { persistSession: false },
  });
}

function rowToProject(row: Record<string, unknown>): Project {
  return ProjectSchema.parse({
    id: row.id,
    title: row.title,
    idea: row.idea,
    device_ids: row.device_ids,
    platform_id: row.platform_id,
    status: row.status,
    checklist: row.checklist,
    parts: row.parts,
    notes: row.notes,
    source: row.source,
    created_at: row.created_at,
    updated_at: row.updated_at,
    synced: true,
  });
}
