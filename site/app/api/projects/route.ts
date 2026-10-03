import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  clerkEnabled,
  supabasePublishableKey,
  supabaseUrl,
} from "../../../lib/auth-config";
import { ProjectSchema, type Project } from "../../../lib/projects/types";

export const runtime = "nodejs";

const postBuckets = new Map<string, { count: number; resetAt: number }>();
const POST_LIMIT = 60;
const MAX_BATCH = 25;
const HOUR_MS = 60 * 60 * 1000;

type AuthState = { userId: string; getToken: () => Promise<string | null> };

export async function GET() {
  const authState = await requireAuth();
  if (authState instanceof NextResponse) return authState;

  const supabase = supabaseFor(authState);
  const { data, error } = await supabase
    .from("build_projects")
    .select("*")
    .eq("user_id", authState.userId)
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ projects: (data ?? []).map(rowToProject) });
}

export async function POST(request: Request) {
  const authState = await requireAuth();
  if (authState instanceof NextResponse) return authState;

  if (!takePostSlot(authState.userId)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const values = Array.isArray(body) ? body : [body];
  if (values.length === 0 || values.length > MAX_BATCH) {
    return NextResponse.json({ error: "batch_size" }, { status: 400 });
  }
  const parsed = values.map((value) => ProjectSchema.safeParse(value));
  const failed = parsed.find((result) => !result.success);
  if (failed && !failed.success) {
    return NextResponse.json({ error: failed.error.message }, { status: 400 });
  }

  const rows = parsed
    .filter((result): result is { success: true; data: Project } => result.success)
    .map((result) => projectToRow(result.data, authState.userId));

  const supabase = supabaseFor(authState);
  const { data, error } = await supabase
    .from("build_projects")
    .upsert(rows, { onConflict: "id" })
    .select("*");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ projects: (data ?? []).map(rowToProject) });
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

function projectToRow(project: Project, userId: string) {
  return {
    id: project.id,
    user_id: userId,
    title: project.title,
    idea: project.idea,
    device_ids: project.device_ids,
    platform_id: project.platform_id,
    status: project.status,
    checklist: project.checklist,
    parts: project.parts,
    notes: project.notes,
    source: project.source,
    created_at: project.created_at,
    updated_at: project.updated_at,
  };
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

function takePostSlot(userId: string): boolean {
  const now = Date.now();
  const current = postBuckets.get(userId);
  if (!current || current.resetAt <= now) {
    postBuckets.set(userId, { count: 1, resetAt: now + HOUR_MS });
    return true;
  }
  if (current.count >= POST_LIMIT) return false;
  current.count += 1;
  return true;
}
