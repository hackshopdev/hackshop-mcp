import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { supabasePublishableKey, supabaseUrl } from "../auth-config";
import { sortIdeas } from "./present";
import { SEED_IDEAS, seedIdeaById } from "./seed";
import {
  IDEA_BUDGETS,
  IDEA_INTERACTIONS,
  IDEA_SENSING,
  IDEA_SIZES,
  IDEAS_LIST_MAX,
  PUBLIC_IDEA_COLUMNS,
  isUuid,
  type IdeaSort,
  type PublicIdea,
} from "./types";

// Reads go through the anon (publishable) key, so RLS and the column grants
// in the migration decide what is visible. When the database is unreachable
// or the ideas table does not exist yet, pages fall back to the seed list.

const DB_TIMEOUT_MS = 4_000;

export type IdeasSource = "live" | "seed";

function timeoutFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const timeout = AbortSignal.timeout(DB_TIMEOUT_MS);
  const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  return fetch(input, { ...init, signal });
}

export function anonIdeasClient(): SupabaseClient {
  return createClient(supabaseUrl, supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: timeoutFetch },
  });
}

/** Client acting as the signed-in Clerk user (Clerk JWT as the access token). */
export function userIdeasClient(getToken: () => Promise<string | null>): SupabaseClient {
  return createClient(supabaseUrl, supabasePublishableKey, {
    accessToken: async () => (await getToken()) ?? null,
    auth: { persistSession: false },
    global: { fetch: timeoutFetch },
  });
}

const PublicIdeaRow = z.object({
  id: z.string(),
  display_name: z.string(),
  title: z.string(),
  body: z.string().nullable().transform((value) => value ?? ""),
  size: z.enum(IDEA_SIZES).nullable(),
  interaction: z.enum(IDEA_INTERACTIONS).nullable(),
  sensing: z.enum(IDEA_SENSING).nullable(),
  budget: z.enum(IDEA_BUDGETS).nullable(),
  suggested_device_id: z.string().nullable(),
  vote_count: z.coerce.number().int().min(0),
  created_at: z.string(),
});

export function rowToIdea(row: unknown): PublicIdea | null {
  const parsed = PublicIdeaRow.safeParse(row);
  if (!parsed.success) return null;
  return { ...parsed.data, created_at: new Date(parsed.data.created_at).toISOString() };
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return IDEAS_LIST_MAX;
  return Math.min(IDEAS_LIST_MAX, Math.max(1, Math.floor(limit)));
}

export function seedList(sort: IdeaSort, limit?: number): PublicIdea[] {
  return sortIdeas(SEED_IDEAS, sort).slice(0, clampLimit(limit));
}

export async function listIdeas(
  options: { sort?: IdeaSort; limit?: number } = {},
): Promise<{ ideas: PublicIdea[]; source: IdeasSource }> {
  const sort = options.sort ?? "top";
  const limit = clampLimit(options.limit);
  try {
    let query = anonIdeasClient()
      .from("ideas")
      .select(PUBLIC_IDEA_COLUMNS)
      .eq("status", "published");
    query = sort === "new"
      ? query.order("created_at", { ascending: false })
      : query.order("vote_count", { ascending: false }).order("created_at", { ascending: false });
    const { data, error } = await query.order("id", { ascending: true }).limit(limit);
    if (error || !Array.isArray(data)) throw new Error(error?.message ?? "no data");
    const ideas = data.map(rowToIdea).filter((idea): idea is PublicIdea => idea !== null);
    return { ideas, source: "live" };
  } catch (err) {
    console.warn(`[ideas] list fell back to seeds: ${(err as Error).message}`);
    return { ideas: seedList(sort, limit), source: "seed" };
  }
}

export async function getIdea(
  id: string,
): Promise<{ idea: PublicIdea | null; source: IdeasSource }> {
  if (!isUuid(id)) return { idea: null, source: "live" };
  try {
    const { data, error } = await anonIdeasClient()
      .from("ideas")
      .select(PUBLIC_IDEA_COLUMNS)
      .eq("id", id)
      .eq("status", "published")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { idea: data ? rowToIdea(data) : null, source: "live" };
  } catch (err) {
    console.warn(`[ideas] get fell back to seeds: ${(err as Error).message}`);
    return { idea: seedIdeaById(id), source: "seed" };
  }
}
