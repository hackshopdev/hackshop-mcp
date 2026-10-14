import "server-only";
import { createClient } from "@supabase/supabase-js";
import { DiscoveryCandidateSchema, DiscoveryDraft, DiscoveryInboxSchema, PublicUrl, type WorkerRequest } from "./types";
import publishedExamples from "../../reverse-engineering-examples.json";
import { hashDiscoveryRecord } from "./hash";
import { lookupClerkUser } from "./clerk";

export class DiscoveryStoreError extends Error {
  constructor(public code: string, public status = 503) { super(code); }
}
function client() {
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://gcmrtdevzgwvhdzromda.supabase.co";
  if (!key) throw new DiscoveryStoreError("queue_unavailable");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(8000) }) },
  });
}
async function rpc(name: string, params: Record<string, unknown>) {
  let result;
  try { result = await client().rpc(name, params); } catch { throw new DiscoveryStoreError("queue_unavailable"); }
  if (result.error) {
    const message = result.error.message ?? "";
    if (message.includes("invalid_resolution")) throw new DiscoveryStoreError("invalid_resolution", 422);
    const known = ["stale_draft", "run_busy", "lease_expired", "not_reviewable", "already_published", "receipt_conflict", "reservation_conflict", "publication_conflict"];
    const code = known.find((code) => message.includes(code));
    if (code) throw new DiscoveryStoreError(code, 409);
    if (message.includes("not_found")) throw new DiscoveryStoreError("not_found", 404);
    throw new DiscoveryStoreError("queue_unavailable");
  }
  if (result.data === null) throw new DiscoveryStoreError("queue_unavailable");
  return result.data;
}
export async function listDiscoveryInbox() {
  try { return DiscoveryInboxSchema.parse(await rpc("discovery_inbox", {})); }
  catch (error) { if (error instanceof DiscoveryStoreError) throw error; throw new DiscoveryStoreError("queue_unavailable"); }
}
export async function getDiscoveryCandidate(id: string) {
  const result = await rpc("discovery_candidate", { p_id: id });
  if (!result.candidate) throw new DiscoveryStoreError("not_found", 404);
  return DiscoveryCandidateSchema.parse(result.candidate);
}
export function canonicalDiscoveryUrl(value: string): string {
  const url = new URL(PublicUrl.parse(value));
  const status = url.pathname.match(/\/(?:[^/]+\/)?status\/(\d+)/);
  if (["x.com", "twitter.com", "mobile.twitter.com"].includes(url.hostname) && status)
    return "https://x.com/i/status/" + status[1];
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid|gclid)/.test(key)) url.searchParams.delete(key);
  return url.toString();
}
export async function intakeDiscovery(url: string, reviewer: string) {
  const canonical = canonicalDiscoveryUrl(url);
  const result = await rpc("discovery_intake", { p_url: canonical, p_reviewer: reviewer });
  return DiscoveryCandidateSchema.parse(result.candidate);
}
export async function reviewDiscovery(id: string, reviewer: string, input: Record<string, unknown>) {
  let prepared = input;
  if (input.action === "edit") {
    const draft = DiscoveryDraft.parse(input.draft);
    prepared = { ...input, draft, draft_hash: hashDiscoveryRecord(draft) };
  }
  const result = await rpc("discovery_review", { p_id: id, p_reviewer: reviewer, p_input: prepared });
  return DiscoveryCandidateSchema.parse(result.candidate);
}
export async function discoveryWorker(input: WorkerRequest) {
  if (input.action === "lookup_clerk_user") {
    try { return { user_id: await lookupClerkUser(input.email) }; }
    catch (error) {
      const code = error instanceof Error ? error.message : "clerk_unavailable";
      throw new DiscoveryStoreError(code, code === "clerk_user_not_found" ? 404 : code === "ambiguous_user" ? 409 : 503);
    }
  }
  const prepared = { ...input };
  if ("items" in prepared) {
    prepared.items = prepared.items.map((item) => {
      const baseline = item.proposal_kind === "enrich"
        ? publishedExamples.find((example) => example.id === item.target_example_id) : undefined;
      if (item.proposal_kind === "enrich" && !baseline) throw new DiscoveryStoreError("unknown_target", 400);
      return {
        ...item, source: { ...item.source, url: canonicalDiscoveryUrl(item.source.url) },
        ...(item.draft ? { draft_hash: hashDiscoveryRecord(item.draft) } : {}),
        ...(baseline ? { base_record_hash: hashDiscoveryRecord(baseline) } : {}),
      };
    });
  }
  const result = await rpc("discovery_worker", { p_action: input.action, p_payload: prepared });
  if (Array.isArray(result.candidates)) result.candidates = result.candidates.map((row: unknown) => DiscoveryCandidateSchema.parse(row));
  if (result.candidate) result.candidate = DiscoveryCandidateSchema.parse(result.candidate);
  return result;
}
