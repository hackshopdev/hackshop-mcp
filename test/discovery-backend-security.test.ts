import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const globals = globalThis as typeof globalThis & {
  __clerkAuthMock?: () => unknown;
  __supabaseCreateClientMock?: (...args: unknown[]) => unknown;
};
const draft = {
  id: "safe-frame", title: "Frame calendar", device_name: "Exact frame",
  exact_models: [], category: "display", summary: "A sourced example", outcome: "Shows a calendar",
  method: "repurpose", evidence: "author_demo", reproducibility: "demo_only", tags: ["calendar"],
  risk_level: "low", warnings: [], sources: [{ label: "Author", url: "https://example.com/frame", kind: "guide", checked_at: "2026-10-14" }],
  last_verified: "2026-10-14",
};
const load = async (path: string) => {
  const module = await import(path).catch(() => null);
  expect(module, `missing discovery implementation ${path}`).not.toBeNull();
  return module!;
};
const req = (path: string, body: unknown, origin = "https://www.hackshop.dev") => new Request(`https://www.hackshop.dev${path}`, {
  method: "POST", headers: { "content-type": "application/json", origin }, body: JSON.stringify(body),
});

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_fixture");
  vi.stubEnv("DISCOVERY_REVIEWER_IDS", "user_reviewer");
  vi.stubEnv("DISCOVERY_WORKER_TOKEN", "fixture-worker-token-with-32-characters");
  vi.stubEnv("SUPABASE_SECRET_KEY", "fixture-server-secret");
  globals.__clerkAuthMock = () => ({ userId: "user_reviewer", getToken: async () => null });
  globals.__supabaseCreateClientMock = () => ({ rpc: async () => ({ data: null, error: { message: "queue offline" } }) });
});
afterEach(() => { vi.unstubAllEnvs(); delete globals.__clerkAuthMock; delete globals.__supabaseCreateClientMock; });

describe("private discovery input boundary", () => {
  it("validates real public drafts and keeps unknown targets unknown", async () => {
    const { DiscoveryDraft } = await load("../site/lib/discoveries/types.ts");
    const parsed = DiscoveryDraft.parse(draft);
    expect(parsed.exact_models).toEqual([]);
    expect(parsed.price).toBeUndefined();
  });
  it("rejects private or credential-bearing source URLs", async () => {
    const { IntakeRequest } = await load("../site/lib/discoveries/types.ts");
    for (const url of ["http://example.com", "https://localhost/a", "https://127.0.0.1/a", "https://[::1]/a", "https://user:pass@example.com/a"]) {
      expect(IntakeRequest.safeParse({ url }).success).toBe(false);
    }
  });
  it("rejects worker approval and reviewer-field injection", async () => {
    const { WorkerRequest } = await load("../site/lib/discoveries/types.ts");
    expect(WorkerRequest.safeParse({ action: "approve", id: "abc" }).success).toBe(false);
    expect(WorkerRequest.safeParse({ action: "read_approved", approved_by: "attacker" }).success).toBe(false);
  });
  it("rejects source URLs hidden inside draft source and price fields", async () => {
    const { DiscoveryDraft } = await load("../site/lib/discoveries/types.ts");
    expect(DiscoveryDraft.safeParse({ ...draft, sources: [{ ...draft.sources[0], url: "https://127.0.0.1/x" }] }).success).toBe(false);
  });
  it("rejects credentials in durable receipts and checkpoints", async () => {
    const { WorkerRequest } = await load("../site/lib/discoveries/types.ts");
    const common = { action: "checkpoint", run_id: "33333333-3333-4333-8333-333333333333", lease_owner: "runner-1" };
    expect(WorkerRequest.safeParse({ ...common, patch: { grok_receipt: { request_id: "request123", status: "pending", callback_token: "secret" } } }).success).toBe(false);
    expect(WorkerRequest.safeParse({ ...common, patch: { checkpoints: { nested: { api_key: "secret" } } } }).success).toBe(false);
  });
  it("requires terminal Grok results to use the atomic ingestion action", async () => {
    const { WorkerRequest } = await load("../site/lib/discoveries/types.ts");
    expect(WorkerRequest.safeParse({ action: "checkpoint", run_id: "33333333-3333-4333-8333-333333333333", lease_owner: "one", patch: { grok_receipt: { request_id: "request123", status: "completed" } } }).success).toBe(false);
  });
  it("validates bounded Grok reservations and exact-email bootstrap lookup", async () => {
    const { WorkerRequest } = await load("../site/lib/discoveries/types.ts");
    expect(WorkerRequest.safeParse({ action: "reserve_grok", run_id: "33333333-3333-4333-8333-333333333333", reservation_key: "attempt-one" }).success).toBe(true);
    expect(WorkerRequest.safeParse({ action: "lookup_clerk_user", email: "owner@example.com" }).success).toBe(true);
    expect(WorkerRequest.safeParse({ action: "lookup_clerk_user", email: "*" }).success).toBe(false);
    expect(WorkerRequest.safeParse({ action: "read_publication" }).success).toBe(true);
    expect(WorkerRequest.safeParse({ action: "ingest_grok_result", request_id: "request123", status: "completed", result_hash: "a".repeat(64), provider_run_id: "response-123" }).success).toBe(true);
    expect(WorkerRequest.safeParse({ action: "checkpoint", run_id: "33333333-3333-4333-8333-333333333333", lease_owner: "one", patch: { grok_receipt: { request_id: "request123", status: "pending", provider: "xai_gateway" } } }).success).toBe(true);
  });
  it("resolves only a single verified exact Clerk account and returns no profile fields", async () => {
    const { exactVerifiedClerkUserId } = await load("../site/lib/discoveries/clerk.ts");
    const user = { id: "user_owner", emailAddresses: [{ emailAddress: "Owner@example.com", verification: { status: "verified" } }], firstName: "Private" };
    expect(exactVerifiedClerkUserId("owner@example.com", [user])).toBe("user_owner");
    expect(() => exactVerifiedClerkUserId("owner@example.com", [user, { ...user, id: "user_second" }])).toThrow();
    expect(() => exactVerifiedClerkUserId("other@example.com", [user])).toThrow();
    expect(() => exactVerifiedClerkUserId("owner@example.com", [{ ...user, emailAddresses: [{ emailAddress: "owner@example.com", verification: { status: "unverified" } }] }])).toThrow();
  });
  it("requires exact approval version and hash", async () => {
    const { ReviewRequest } = await load("../site/lib/discoveries/types.ts");
    expect(ReviewRequest.safeParse({ action: "approve", version: 1 }).success).toBe(false);
    expect(ReviewRequest.safeParse({ action: "approve", version: 1, hash: "a".repeat(64) }).success).toBe(true);
  });
  it("accepts only bounded, explicit reviewer evidence resolutions", async () => {
    const { EditRequest } = await load("../site/lib/discoveries/types.ts");
    const resolution = { claim: "Exact model is unknown", source_url: draft.sources[0].url, note: "The author's guide does not name an exact model." };
    const input = { version: 1, hash: "a".repeat(64), draft, resolved_claims: [resolution] };
    expect(EditRequest.safeParse(input).success).toBe(true);
    expect(EditRequest.safeParse({ ...input, resolved_claims: [resolution, resolution] }).success).toBe(false);
    expect(EditRequest.safeParse({ ...input, resolved_claims: [{ ...resolution, note: "looks fine" }] }).success).toBe(false);
    expect(EditRequest.safeParse({ ...input, resolved_claims: [{ ...resolution, approved_by: "attacker" }] }).success).toBe(false);
    expect(EditRequest.safeParse({ ...input, unresolved_claims: [] }).success).toBe(false);
    expect(EditRequest.safeParse({ ...input, draft_hash: "f".repeat(64) }).success).toBe(false);
    const large = Array.from({ length: 10 }, (_, i) => ({ claim: i + "x".repeat(599), source_url: draft.sources[0].url, note: "é".repeat(600) }));
    expect(EditRequest.safeParse({ ...input, resolved_claims: large }).success).toBe(false);
  });
  it("supports an explicit enrichment target without allowing an ambiguous target", async () => {
    const { IngestItem } = await load("../site/lib/discoveries/types.ts");
    const input = { project_key: "repo:42", source: { label: "Guide", url: "https://example.com/frame", kind: "guide" }, proposal_kind: "enrich", target_example_id: "safe-frame" };
    expect(IngestItem.safeParse(input).success).toBe(true);
    expect(IngestItem.safeParse({ ...input, target_example_id: undefined }).success).toBe(false);
  });
  it("uses the server's published baseline for enrichment and rejects a supplied baseline", async () => {
    const { readFileSync } = await import("node:fs");
    const published = JSON.parse(readFileSync(new URL("../site/reverse-engineering-examples.json", import.meta.url), "utf8"))[0];
    const { WorkerRequest } = await load("../site/lib/discoveries/types.ts");
    const { hashDiscoveryRecord } = await load("../site/lib/discoveries/hash.ts");
    const input = { action: "ingest", run_id: "33333333-3333-4333-8333-333333333333", lease_owner: "one", items: [{ project_key: "enrich:one", proposal_kind: "enrich", target_example_id: published.id, draft, source: { label: "Guide", url: "https://example.com/frame", kind: "guide" } }] };
    expect(WorkerRequest.safeParse({ ...input, items: [{ ...input.items[0], base_record_hash: "a".repeat(64) }] }).success).toBe(false);
    expect(WorkerRequest.safeParse({ ...input, items: [{ ...input.items[0], draft_hash: "a".repeat(64) }] }).success).toBe(false);
    const rpc = vi.fn(async () => ({ data: { candidates: [] }, error: null }));
    globals.__supabaseCreateClientMock = () => ({ rpc });
    const { discoveryWorker } = await load("../site/lib/discoveries/store.ts");
    await discoveryWorker(WorkerRequest.parse(input));
    expect(rpc.mock.calls[0][1].p_payload.items[0].base_record_hash).toBe(hashDiscoveryRecord(published));
    expect(rpc.mock.calls[0][1].p_payload.items[0].draft_hash).toBe(hashDiscoveryRecord(WorkerRequest.parse(input).items[0].draft));
  });
});

describe("reviewer and worker HTTP boundary", () => {
  it("returns 401 to an unsigned visitor without touching storage", async () => {
    globals.__clerkAuthMock = () => ({ userId: null, getToken: async () => null });
    const db = vi.fn(); globals.__supabaseCreateClientMock = db;
    const { GET } = await load("../site/app/api/admin/discoveries/route.ts");
    const response = await GET();
    expect(response.status).toBe(401); expect(db).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("returns 403 to an ordinary signed-in user", async () => {
    globals.__clerkAuthMock = () => ({ userId: "user_else", getToken: async () => null });
    const { GET } = await load("../site/app/api/admin/discoveries/route.ts");
    expect((await GET()).status).toBe(403);
  });
  it("reports auth outages as unavailable", async () => {
    globals.__clerkAuthMock = () => { throw new Error("offline"); };
    const { GET } = await load("../site/app/api/admin/discoveries/route.ts");
    const response = await GET(); expect(response.status).toBe(503);
    expect((await response.json()).error).toBe("auth_unavailable");
  });
  it("reports queue outages instead of returning an empty successful inbox", async () => {
    const { GET } = await load("../site/app/api/admin/discoveries/route.ts");
    const response = await GET(); expect(response.status).toBe(503);
    expect((await response.json()).error).toBe("queue_unavailable");
  });
  it("rejects cross-origin reviewer mutations", async () => {
    const { POST } = await load("../site/app/api/admin/discoveries/route.ts");
    expect((await POST(req("/api/admin/discoveries", { url: "https://example.com/frame" }, "https://attacker.com"))).status).toBe(403);
  });
  it("requires worker bearer authentication", async () => {
    const { POST } = await load("../site/app/api/discovery-worker/route.ts");
    expect((await POST(req("/api/discovery-worker", { action: "read_approved" }))).status).toBe(401);
  });
  it("never passes a user token to the administrative Supabase client", async () => {
    const client = vi.fn(() => ({ rpc: async () => ({ data: { candidates: [], runs: [], stats: { total: 0, needs_review: 0, needs_evidence: 0, approved: 0, published: 0 }, source: "live" }, error: null }) }));
    globals.__supabaseCreateClientMock = client;
    const { GET } = await load("../site/app/api/admin/discoveries/route.ts");
    expect((await GET()).status).toBe(200);
    expect((client.mock.calls[0] as unknown[])[2]).not.toHaveProperty("accessToken");
  });
  it("maps atomic database version conflicts to 409 without retrying", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: "stale_draft", code: "P0001" } }));
    globals.__supabaseCreateClientMock = () => ({ rpc });
    const { POST } = await load("../site/app/api/admin/discoveries/[id]/review/route.ts");
    const response = await POST(req("/api/admin/discoveries/id/review", { action: "approve", version: 1, hash: "a".repeat(64) }), { params: Promise.resolve({ id: "33333333-3333-4333-8333-333333333333" }) });
    expect(response.status).toBe(409); expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("reports an unmatched evidence resolution as 422 without exposing storage errors", async () => {
    globals.__supabaseCreateClientMock = () => ({ rpc: async () => ({ data: null, error: { message: "invalid_resolution: private database detail" } }) });
    const { PATCH } = await load("../site/app/api/admin/discoveries/[id]/route.ts");
    const response = await PATCH(req("/api/admin/discoveries/id", { version: 1, hash: "a".repeat(64), draft, resolved_claims: [{ claim: "Exact model is unknown", source_url: draft.sources[0].url, note: "The author's source does not publish an exact model." }] }), { params: Promise.resolve({ id: "33333333-3333-4333-8333-333333333333" }) });
    expect(response.status).toBe(422); expect(await response.json()).toEqual({ error: "invalid_resolution" });
  });
});
