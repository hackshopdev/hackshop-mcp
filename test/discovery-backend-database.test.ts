import { beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { hashDiscoveryRecord } from "../site/lib/discoveries/hash";

const db = process.env.DISCOVERY_TEST_DATABASE_URL;
const suite = db ? describe : describe.skip;
const literal = (value: unknown) => "'" + JSON.stringify(value).replaceAll("'", "''") + "'::jsonb";
function sql(statement: string) {
  if (!db || !/^postgresql:\/\/[^/]*127\.0\.0\.1:55437\//.test(db)) throw new Error("Use the isolated discovery test database only");
  return execFileSync("psql", ["-X", "-qAt", "-v", "ON_ERROR_STOP=1", db, "-c", statement], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}
function worker(action: string, input: Record<string, unknown> = {}) {
  return JSON.parse(sql("set role service_role; select public.discovery_worker('" + action + "'," + literal({ action, ...input }) + ");"));
}
const draft = { id: "test-frame", title: "Test frame", device_name: "Exact frame", exact_models: [], category: "display", summary: "Sourced", outcome: "Calendar", method: "repurpose", evidence: "author_demo", reproducibility: "demo_only", tags: ["calendar"], risk_level: "low", warnings: [], sources: [{ label: "Author", kind: "guide", url: "https://example.com/frame", checked_at: "2026-10-14" }], last_verified: "2026-10-14" };
const begin = (owner = "test-runner") => worker("begin_run", { run_key: randomUUID(), lease_owner: owner, window_start: "2026-10-13T00:00:00Z", window_end: "2026-10-14T00:00:00Z" }).run;
const ingest = (run: Record<string, unknown>, extra: Record<string, unknown> = {}) => worker("ingest", {
  run_id: run.id, lease_owner: run.lease_owner, items: [{ project_key: randomUUID(), source: { url: "https://example.com/" + randomUUID(), label: "Author", kind: "guide", checked_at: "2026-10-14", author: null, published_at: null, excerpt: "" }, draft, status: "ready_for_review", unresolved_claims: [], research_notes: "", ...extra, draft_hash: hashDiscoveryRecord(extra.draft ?? draft) }],
}).candidates[0];
const review = (candidate: Record<string, unknown>, action: string, hash = candidate.draft_hash) => JSON.parse(sql("set role service_role; select public.discovery_review('" + candidate.id + "','user_reviewer'," + literal({ action, version: candidate.draft_version, hash }) + ");")).candidate;

suite("private discovery SQL behavior", () => {
  beforeAll(() => {
    sql("do $$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if; if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if; end $$;");
    sql(readFileSync(new URL("../supabase/migrations/20261014214826_hardware_discovery.sql", import.meta.url), "utf8"));
    sql(readFileSync(new URL("../supabase/migrations/20261014220216_discovery_evidence_resolution.sql", import.meta.url), "utf8"));
    sql("truncate public.discovery_review_events, public.discovery_sources, public.discovery_candidates, public.discovery_runs;");
  });
  it("revokes both private rows and RPC execution from client roles", () => {
    for (const role of ["anon", "authenticated"]) {
      expect(sql("select has_table_privilege('" + role + "','public.discovery_candidates','select');")).toBe("f");
      expect(sql("select has_function_privilege('" + role + "','public.discovery_worker(text,jsonb)','execute');")).toBe("f");
    }
    expect(sql("select relrowsecurity from pg_class where oid='public.discovery_candidates'::regclass;")).toBe("t");
  });
  it("reuses logical runs but rejects a concurrent lease owner", () => {
    const key = randomUUID();
    const input = { run_key: key, lease_owner: "one", window_start: "2026-10-13T00:00:00Z", window_end: "2026-10-14T00:00:00Z" };
    const first = worker("begin_run", input); const repeated = worker("begin_run", input);
    expect(repeated.run.id).toBe(first.run.id); expect(repeated.replayed).toBe(true);
    expect(() => worker("begin_run", { ...input, lease_owner: "two" })).toThrow();
  });
  it("reserves credits atomically and makes settlement idempotent", () => {
    const run = begin();
    const first = worker("reserve_credits", { run_id: run.id, reservation_key: "read-1", credits: 8 });
    expect(first.allowed).toBe(true);
    expect(worker("reserve_credits", { run_id: run.id, reservation_key: "read-1", credits: 8 }).replayed).toBe(true);
    expect(worker("reserve_credits", { run_id: run.id, reservation_key: "read-2", credits: 5 }).allowed).toBe(false);
    worker("settle_credits", { run_id: run.id, reservation_key: "read-1", charged_credits: 0 });
    expect(worker("reserve_credits", { run_id: run.id, reservation_key: "read-2", credits: 5 }).allowed).toBe(true);
  });
  it("binds approval to a locked version and hash", () => {
    const candidate = ingest(begin());
    expect(() => review(candidate, "approve", "a".repeat(64))).toThrow();
    const approved = review(candidate, "approve");
    expect(approved.publication_status).toBe("approved"); expect(approved.approved_hash).toBe(candidate.draft_hash);
    expect(approved.approved_version).toBe(candidate.draft_version);
    expect(approved.approved_hash).toBe(hashDiscoveryRecord(approved.draft));
    expect(() => review(candidate, "approve")).toThrow();
  });
  it("worker ingestion preserves reviewed drafts and human rejection", () => {
    const run = begin(); const candidate = ingest(run); const approved = review(candidate, "approve");
    const unchanged = ingest(run, { project_key: candidate.project_key, draft: { ...draft, title: "Unapproved overwrite" } });
    expect(unchanged.draft.title).toBe(approved.draft.title); expect(unchanged.approved_hash).toBe(approved.approved_hash);
    const rejected = review(ingest(run), "reject");
    expect(ingest(run, { project_key: rejected.project_key }).research_status).toBe("rejected");
  });
  it("edits reset approval and make the old reviewed hash stale", () => {
    const approved = review(ingest(begin()), "approve");
    const newDraft = { ...draft, title: "Reviewed edit" };
    const result = JSON.parse(sql("set role service_role; select public.discovery_review('" + approved.id + "','user_reviewer'," + literal({ action: "edit", version: approved.draft_version, hash: approved.draft_hash, draft: newDraft, draft_hash: hashDiscoveryRecord(newDraft) }) + ");")).candidate;
    expect(result.publication_status).toBe("unreviewed"); expect(result.approved_hash).toBeNull();
    expect(result.draft_version).toBe(approved.draft_version + 1); expect(() => review(approved, "approve")).toThrow();
  });
  it("does not clear evidence gaps merely because a reviewer saves a draft", () => {
    const candidate = ingest(begin(), { status: "needs_evidence", unresolved_claims: ["Exact model is unknown"] });
    const result = JSON.parse(sql("set role service_role; select public.discovery_review('" + candidate.id + "','user_reviewer'," + literal({ action: "edit", version: candidate.draft_version, hash: candidate.draft_hash, draft, draft_hash: hashDiscoveryRecord(draft) }) + ");")).candidate;
    expect(result.unresolved_claims).toEqual(["Exact model is unknown"]); expect(result.research_status).toBe("needs_evidence");
    expect(() => review(result, "approve")).toThrow();
  });
  it("resolves only explicitly cited current claims and audits the explanation", () => {
    const claims = ["Exact model is unknown", "Current price is unknown"];
    const candidate = ingest(begin(), { status: "needs_evidence", unresolved_claims: claims });
    const resolution = { claim: claims[0], source_url: draft.sources[0].url, note: "The author's guide omits the model, so compatibility remains unknown." };
    const input = { action: "edit", version: candidate.draft_version, hash: candidate.draft_hash, draft, draft_hash: hashDiscoveryRecord(draft), resolved_claims: [resolution] };
    const edited = JSON.parse(sql("set role service_role; select public.discovery_review('" + candidate.id + "','user_reviewer'," + literal(input) + ");")).candidate;
    expect(edited.unresolved_claims).toEqual([claims[1]]); expect(edited.research_status).toBe("needs_evidence"); expect(edited.draft.exact_models).toEqual([]);
    expect(JSON.parse(sql("select metadata from public.discovery_review_events where candidate_id='" + candidate.id + "' and action='edit' order by created_at desc limit 1;"))).toEqual({ resolved_claims: [resolution] });
    expect(() => sql("set role service_role; select public.discovery_review('" + candidate.id + "','user_reviewer'," + literal(input) + ");")).toThrow();
    const final = JSON.parse(sql("set role service_role; select public.discovery_review('" + edited.id + "','user_reviewer'," + literal({ ...input, version: edited.draft_version, hash: edited.draft_hash, resolved_claims: [{ claim: claims[1], source_url: draft.sources[0].url, note: "This guide has no current seller price; leave the price unknown." }] }) + ");")).candidate;
    expect(final.unresolved_claims).toEqual([]); expect(final.research_status).toBe("ready_for_review"); expect(final.draft.price).toBeUndefined();
    expect(review(final, "approve").publication_status).toBe("approved");
  });
  it("rejects unmatched, duplicate, unlinked and injected evidence resolutions atomically", () => {
    const candidate = ingest(begin(), { status: "needs_evidence", unresolved_claims: ["Exact model is unknown"] });
    const resolution = { claim: "Exact model is unknown", source_url: draft.sources[0].url, note: "The author's guide does not name an exact model." };
    const resolutions = [[{ ...resolution, claim: "Not a current claim" }], [{ ...resolution, source_url: "https://unlinked.example.com/guide" }], [resolution, resolution], [{ ...resolution, note: "Fine" }], [{ ...resolution, approved_by: "attacker" }]];
    for (const resolved_claims of resolutions) {
      expect(() => sql("set role service_role; select public.discovery_review('" + candidate.id + "','user_reviewer'," + literal({ action: "edit", version: candidate.draft_version, hash: candidate.draft_hash, draft, draft_hash: hashDiscoveryRecord(draft), resolved_claims }) + ");")).toThrow();
    }
    const after = JSON.parse(sql("set role service_role; select public.discovery_candidate('" + candidate.id + "');")).candidate;
    expect(after.draft_version).toBe(candidate.draft_version); expect(after.unresolved_claims).toEqual(candidate.unresolved_claims);
  });
  it("gives a human-requested research retry a fresh durable attempt version", () => {
    const candidate = ingest(begin(), { status: "needs_evidence", unresolved_claims: ["Need a source"] });
    const requested = review(candidate, "needs_research");
    expect(requested.research_status).toBe("researching"); expect(requested.draft_version).toBe(candidate.draft_version + 1);
    expect(requested.unresolved_claims).toEqual(candidate.unresolved_claims); expect(requested.approved_hash).toBeNull();
    expect(() => review(candidate, "needs_research")).toThrow();
  });
  it("researches a manual primary URL without silently reassigning its source identity", () => {
    const url = "https://github.com/maker/dashboard";
    const candidate = JSON.parse(sql("set role service_role; select public.discovery_intake('" + url + "','user_reviewer');")).candidate;
    expect(candidate.project_key).toMatch(/^url:[a-f0-9]{64}$/); expect(candidate.draft).toBeNull();
    const run = begin();
    const primaryDraft = { ...draft, sources: [{ ...draft.sources[0], url }] };
    const item = { project_key: candidate.project_key, source: { url, label: "Project repository", kind: "repo", checked_at: "2026-10-14" }, draft: primaryDraft, draft_hash: hashDiscoveryRecord(primaryDraft), status: "needs_evidence", unresolved_claims: ["Exact model needs review"] };
    const researched = worker("ingest", { run_id: run.id, lease_owner: run.lease_owner, items: [item] }).candidates[0];
    expect(researched.id).toBe(candidate.id); expect(researched.draft.title).toBe("Test frame"); expect(researched.research_status).toBe("needs_evidence");
    const conflicting = worker("ingest", { run_id: run.id, lease_owner: run.lease_owner, items: [{ ...item, project_key: "github:maker/dashboard", draft: { ...primaryDraft, title: "Silent source reassignment" } }] }).candidates[0];
    expect(conflicting.id).toBe(candidate.id); expect(conflicting.project_key).toBe(candidate.project_key); expect(conflicting.draft.title).toBe("Test frame");
  });
  it("returns a real missing-candidate state", () => {
    expect(sql("set role service_role; select public.discovery_candidate('" + randomUUID() + "');")).toBe('{"candidate": null}');
  });
  it("cannot escape today's budget through a prior-day run", () => {
    sql("update public.discovery_runs set credit_reservations='{}';");
    const old = begin();
    sql("update public.discovery_runs set budget_date=current_date-1 where id='" + old.id + "';");
    expect(worker("reserve_credits", { run_id: old.id, reservation_key: "old-run-today", credits: 12 }).allowed).toBe(true);
    expect(worker("reserve_credits", { run_id: begin().id, reservation_key: "new-run-today", credits: 1 }).allowed).toBe(false);
  });
  it("harvests a completed Grok result after the original run ended and does not import it twice", () => {
    const run = begin(); const request_id = "test-" + randomUUID();
    worker("checkpoint", { run_id: run.id, lease_owner: run.lease_owner, patch: { grok_receipt: { request_id, status: "pending" } } });
    worker("finish_run", { run_id: run.id, lease_owner: run.lease_owner, status: "partial" });
    const payload = { request_id, status: "completed", result_hash: "f".repeat(64), items: [{ project_key: "grok:" + randomUUID(), source: { url: "https://example.com/" + randomUUID(), label: "Author", kind: "guide", checked_at: "2026-10-14" }, draft, draft_hash: hashDiscoveryRecord(draft), status: "ready_for_review", unresolved_claims: [] }] };
    const first = worker("ingest_grok_result", payload);
    expect(first.candidates).toHaveLength(1); expect(first.run.grok_receipt.status).toBe("completed");
    expect(worker("ingest_grok_result", payload).replayed).toBe(true);
    expect(worker("read_pending").runs.some((item: Record<string, unknown>) => item.id === run.id)).toBe(false);
    expect(() => worker("ingest_grok_result", { ...payload, result_hash: "a".repeat(64) })).toThrow();
  });
  it("applies the monthly cap while preserving a new day's allowance", () => {
    sql("update public.discovery_runs set credit_reservations='{}';");
    const historical = begin();
    sql("update public.discovery_runs set credit_reservations=jsonb_build_object('history',jsonb_build_object('reserved',360,'charged',360,'reserved_at',date_trunc('month',now())::text)) where id='" + historical.id + "';");
    const result = worker("reserve_credits", { run_id: begin().id, reservation_key: "month-overflow", credits: 1 });
    expect(result.allowed).toBe(false); expect(result.monthly_remaining).toBe(0);
    const isFirstDay = sql("select extract(day from now() at time zone 'UTC')=1;") === "t";
    expect(result.daily_remaining).toBe(isFirstDay ? 0 : 12);
  });
  it("allows only one Grok network attempt per UTC day, including ambiguous calls", () => {
    const run = begin();
    expect(worker("reserve_grok", { run_id: run.id, reservation_key: "first" }).allowed).toBe(true);
    expect(worker("reserve_grok", { run_id: run.id, reservation_key: "first" }).replayed).toBe(true);
    expect(worker("reserve_grok", { run_id: begin().id, reservation_key: "other" }).allowed).toBe(false);
  });
  it("reconciles existing publication without losing approval integrity", () => {
    const approved = review(ingest(begin()), "approve");
    const input = { id: approved.id, hash: approved.draft_hash, version: approved.draft_version, pr_url: "https://github.com/hackshopdev/hackshop-mcp/pull/123", pr_head_sha: "a".repeat(40) };
    worker("mark_pr", input); worker("mark_pr", input);
    const published = worker("read_publication").candidates.find((item: Record<string, unknown>) => item.id === approved.id);
    expect(published.publication_status).toBe("pr_open"); expect(published.approved_version).toBe(approved.draft_version);
    expect(worker("read_approved").candidates.some((item: Record<string, unknown>) => item.id === approved.id)).toBe(false);
    expect(() => worker("mark_live", { id: approved.id, hash: "f".repeat(64), version: approved.draft_version, merge_sha: "b".repeat(40), verified_at: new Date().toISOString(), proof_urls: ["https://www.hackshop.dev/reverse-engineering.json"] })).toThrow();
  });
});
