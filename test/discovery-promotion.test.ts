import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hashDiscoveryRecord } from "../site/lib/discoveries/hash";
import { reverseEngineeringExampleSummary } from "../src/core/reverse-engineering-tools";
import type { DiscoveryCandidate } from "../site/lib/discoveries/types";

const promotion = await import("../scripts/discoveries/promote.js").catch(() => ({})) as typeof import("../scripts/discoveries/promote.js");
const library = JSON.parse(readFileSync("reverse-engineering-examples.json", "utf8"));
const catalog = JSON.parse(readFileSync("catalog.json", "utf8"));
const draft = { ...library[0], id: "reviewed-display-example", title: "Reviewed display example" };
const candidate = (patch: Partial<DiscoveryCandidate> = {}): DiscoveryCandidate => ({
  id: "01234567-1234-4234-8234-0123456789ab", project_key: "github:maker/display",
  proposal_kind: "new", target_example_id: null, research_status: "ready_for_review", publication_status: "approved",
  draft, draft_version: 3, draft_hash: hashDiscoveryRecord(draft), sources: [], unresolved_claims: [], research_notes: "",
  approved_at: "2026-10-14T12:00:00Z", approved_hash: hashDiscoveryRecord(draft), approved_version: 3,
  base_record_hash: null, pr_url: null, created_at: "2026-10-14T12:00:00Z", updated_at: "2026-10-14T12:00:00Z", ...patch,
});
const SHA_MAIN = "a".repeat(40), SHA_HEAD = "b".repeat(40), SHA_TREE = "c".repeat(40), SHA_MERGE = "d".repeat(40);
const PATHS = ["reverse-engineering-examples.json", "site/reverse-engineering-examples.json"];

function fixture(input: { approved?: DiscoveryCandidate[]; publication?: DiscoveryCandidate[]; main?: unknown[]; existing?: boolean; merged?: boolean; closed?: boolean } = {}) {
  const c = input.approved?.[0] ?? input.publication?.[0] ?? candidate();
  const branch = `codex/discovery-${c.id}-${c.approved_hash!.slice(0, 12)}`;
  const proposed = c.proposal_kind === "enrich" ? library.map((row: any) => row.id === c.target_example_id ? c.draft : row) : [...library, c.draft];
  const calls: { url: string; method: string; body?: any; headers: Headers }[] = [];
  const state = {
    main: input.main ?? library, base: library, head: proposed, mirror: undefined as unknown[] | undefined,
    branch: input.existing ?? false, pr: input.existing ?? false, merged: input.merged ?? false,
    closed: input.closed ?? false, prHead: SHA_HEAD, changedFiles: PATHS, markPrError: false,
    site: proposed, mcp: reverseEngineeringExampleSummary(c.draft!), siteStatus: 200, mcpError: false,
    failReads: false, corruptQueue: false, movedMain: false,
    historicalFile: false, wrongReceipt: false, raceRef: false, racePull: false,
    wrongLiveReceipt: false, mcpText: null as any,
  };
  const pr = () => ({ number: 7, html_url: "https://github.com/hackshopdev/hackshop-mcp/pull/7", state: state.closed || state.merged ? "closed" : "open", merged: state.merged, merge_commit_sha: state.merged ? SHA_MERGE : null,
    head: { ref: branch, sha: state.prHead, repo: { full_name: "hackshopdev/hackshop-mcp" } }, base: { ref: "main", repo: { full_name: "hackshopdev/hackshop-mcp" } } });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const fetcher = async (value: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(value));
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url: url.href, method, body, headers: new Headers(init.headers) });
    if (url.hostname === "www.hackshop.dev") {
      if (url.pathname === "/api/discovery-worker") {
        if (body.action === "read_approved") return json(state.corruptQueue ? {} : { candidates: input.approved ?? [] });
        if (body.action === "read_publication") return json({ candidates: input.publication ?? [] });
        if (body.action === "mark_pr") return state.markPrError ? json({ error: "stale_draft" }, 409) : json({ candidate: { ...c, publication_status: "pr_open", pr_url: body.pr_url, pr_head_sha: body.pr_head_sha, approved_version: state.wrongReceipt ? 2 : c.approved_version } });
        if (body.action === "mark_live") return json({ candidate: { ...c, publication_status: "site_live", merge_sha: state.wrongLiveReceipt ? SHA_HEAD : body.merge_sha, verified_at: body.verified_at, proof_urls: body.proof_urls } });
      }
      if (url.pathname === "/api/reverse-engineering-examples") return json({ examples: state.site }, state.siteStatus);
      if (url.pathname === "/mcp") return json(state.mcpError ? { jsonrpc: "2.0", id: 1, error: { code: -32000, message: "unavailable" } } : { jsonrpc: "2.0", id: 1, result: { structuredContent: { matches: [state.mcp] }, content: [{ type: "text", text: JSON.stringify({ matches: [state.mcpText ?? state.mcp] }) }] } });
    }
    const path = url.pathname.replace("/repos/hackshopdev/hackshop-mcp", "");
    if (state.failReads && method === "GET") return json({ message: "unavailable" }, 503);
    if (path === "/git/ref/heads/main") return json({ object: { sha: state.movedMain ? SHA_MERGE : SHA_MAIN } });
    if (path === `/git/ref/heads/${branch}`) return state.branch ? json({ object: { sha: SHA_HEAD } }) : json({ message: "Not Found" }, 404);
    if (path.startsWith("/git/commits/") && method === "GET") return json({ sha: path.split("/").at(-1), tree: { sha: SHA_TREE }, parents: path.endsWith(SHA_HEAD) ? [{ sha: SHA_MAIN }] : [] });
    if (path.startsWith("/contents/")) {
      const file = decodeURIComponent(path.slice("/contents/".length));
      const ref = url.searchParams.get("ref");
      const records = file === "catalog.json" ? catalog : ref === SHA_HEAD ? state.head : ref === SHA_MERGE ? state.main : state.base;
      const selected = file === PATHS[1] && state.mirror ? state.mirror : records;
      return json({ type: "file", encoding: "base64", content: Buffer.from(JSON.stringify(selected, null, 2) + "\n").toString("base64") });
    }
    if (path.startsWith("/compare/")) return json({ files: state.changedFiles.map((filename) => ({ filename, status: "modified" })) });
    if (path === "/pulls" && method === "GET") return json(state.pr ? [pr()] : []);
    if (path === "/pulls/7" && method === "GET") return json(pr());
    if (path === "/pulls/7/files" && method === "GET") return json([...PATHS, ...(state.historicalFile ? ["src/server.ts"] : [])].map((filename) => ({ filename, status: "modified" })));
    if (path === "/git/trees" && method === "POST") return json({ sha: SHA_TREE }, 201);
    if (path === "/git/commits" && method === "POST") return json({ sha: SHA_HEAD }, 201);
    if (path === "/git/refs" && method === "POST") { state.branch = true; return state.raceRef ? json({ message: "Reference exists" }, 422) : json({ object: { sha: SHA_HEAD } }, 201); }
    if (path === "/pulls" && method === "POST") { state.pr = true; return state.racePull ? json({ message: "PR exists" }, 422) : json(pr(), 201); }
    throw new Error(`Unexpected request ${method} ${url}`);
  };
  const run = async () => promotion.runPromotion?.({ githubToken: "github-test-token", workerToken: "worker-test-token", fetch: fetcher as typeof fetch, now: new Date("2026-10-14T13:00:00Z") });
  return { c, state, calls, run, branch };
}

describe("approval-only discovery publisher", () => {
  it("requires exact approved version, exact approved hash and actual draft hash", () => {
    for (const patch of [{ approved_version: 2 }, { approved_hash: "0".repeat(64) }, { draft_hash: "0".repeat(64) }, { unresolved_claims: ["model unknown"] }, { publication_status: "unreviewed" as const }]) {
      expect(() => promotion.validateApprovedCandidate?.(candidate(patch))).toThrow();
    }
  });
  it("validates schema and catalog device IDs before preparing a data-only patch", () => {
    const bad = { ...draft, catalog_device_ids: ["missing-catalog-board"] };
    expect(() => promotion.buildPromotion?.(candidate({ draft: bad, draft_hash: hashDiscoveryRecord(bad), approved_hash: hashDiscoveryRecord(bad) }), library, catalog)).toThrow("unknown_catalog_device");
    expect(() => promotion.buildPromotion?.(candidate(), library, [])).toThrow();
  });
  it("refuses a new record ID collision even if content happens to be identical", () => {
    expect(() => promotion.buildPromotion?.(candidate(), [...library, draft], catalog)).toThrow("example_id_collision");
  });
  it("enriches only the exact target whose baseline is still current", () => {
    const edited = { ...library[0], summary: "Human-reviewed clarification." };
    const c = candidate({ proposal_kind: "enrich", target_example_id: edited.id, base_record_hash: hashDiscoveryRecord(library[0]), draft: edited, draft_hash: hashDiscoveryRecord(edited), approved_hash: hashDiscoveryRecord(edited) });
    const result = promotion.buildPromotion?.(c, library, catalog);
    expect(result?.filter((record: any) => record.id === edited.id)).toEqual([edited]);
    expect(result).toHaveLength(library.length);
    expect(() => promotion.buildPromotion?.(c, [{ ...library[0], summary: "Changed on main" }, ...library.slice(1)], catalog)).toThrow("stale_enrichment_base");
    expect(() => promotion.buildPromotion?.({ ...c, target_example_id: library[1].id }, library, catalog)).toThrow("enrichment_id_mismatch");
  });
  it("creates one immutable data-only branch and manual-merge PR from fresh main", async () => {
    const f = fixture({ approved: [candidate()] });
    const result = await f.run();
    expect(result?.results[0].status).toBe("pr_open");
    const writes = f.calls.filter((call) => call.url.startsWith("https://api.github.com/") && call.method === "POST");
    expect(writes.map((call) => new URL(call.url).pathname.split("/").at(-1))).toEqual(["trees", "commits", "refs", "pulls"]);
    expect(writes[0].body.base_tree).toBe(SHA_TREE);
    expect(writes[0].body.tree.map((entry: any) => entry.path)).toEqual(PATHS);
    expect(writes[0].body.tree[0].content).toBe(writes[0].body.tree[1].content);
    expect(writes[1].body.parents).toEqual([SHA_MAIN]);
    expect(writes[2].body.ref).toBe(`refs/heads/${f.branch}`);
    expect(writes[3].body.base).toBe("main");
    expect(writes[3].body.body).toContain("Manual merge");
    expect(f.calls.find((call) => call.body?.action === "mark_pr")?.body).toMatchObject({ version: 3, hash: f.c.approved_hash, pr_head_sha: SHA_HEAD });
    expect(f.calls.some((call) => call.url.includes("/merge"))).toBe(false);
  });
  it("reconciles an existing deterministic branch/PR without a second GitHub mutation", async () => {
    const f = fixture({ approved: [candidate()], existing: true });
    expect((await f.run())?.results[0].status).toBe("pr_open");
    expect(f.calls.filter((call) => call.url.startsWith("https://api.github.com") && call.method !== "GET")).toHaveLength(0);
    expect(f.calls.filter((call) => call.body?.action === "mark_pr")).toHaveLength(1);
  });
  it("refuses existing branch changes outside the two data files", async () => {
    const f = fixture({ approved: [candidate()], existing: true });
    f.state.changedFiles = [...PATHS, "site/app/mcp/route.ts"];
    expect((await f.run())?.results[0]).toMatchObject({ status: "blocked", error: "unsafe_branch_diff" });
    expect(f.calls.some((call) => call.body?.action === "mark_pr")).toBe(false);
  });
  it("refuses branch data that differs from the approved snapshot or changes unrelated records", async () => {
    const f = fixture({ approved: [candidate()], existing: true });
    f.state.head = [{ ...library[0], title: "Unexpected mutation" }, ...library.slice(1), draft];
    expect((await f.run())?.results[0]).toMatchObject({ status: "blocked", error: "branch_snapshot_mismatch" });
  });
  it("keeps a closed unmerged PR closed and never publishes it", async () => {
    const f = fixture({ approved: [candidate()], existing: true, closed: true });
    expect((await f.run())?.results[0]).toMatchObject({ status: "blocked", error: "pr_closed_unmerged" });
    expect(f.calls.some((call) => call.body?.action === "mark_pr" || call.body?.action === "mark_live")).toBe(false);
  });
  it("fails closed on main mirror drift and unavailable GitHub reads", async () => {
    for (const fault of ["mirror", "failReads"]) {
      const f = fixture({ approved: [candidate()] });
      if (fault === "mirror") f.state.mirror = [...library, draft]; else f.state.failReads = true;
      expect((await f.run())?.results[0].status).toBe("blocked");
      expect(f.calls.some((call) => call.url.startsWith("https://api.github.com") && call.method === "POST")).toBe(false);
    }
  });
  it("does not turn queue failure or malformed queue data into an empty successful run", async () => {
    const f = fixture(); f.state.corruptQueue = true;
    await expect(f.run()).rejects.toThrow("invalid_queue_response");
  });
  it("preserves stale approval errors after GitHub PR creation without marking success", async () => {
    const f = fixture({ approved: [candidate()] }); f.state.markPrError = true;
    expect((await f.run())?.results[0]).toMatchObject({ status: "blocked", error: "worker_stale_draft" });
  });
  it("checks the whole PR diff, not merely the last commit, before recording approval", async () => {
    const f = fixture({ approved: [candidate()], existing: true }); f.state.historicalFile = true;
    expect((await f.run())?.results[0]).toMatchObject({ status: "blocked", error: "unsafe_pull_diff" });
    expect(f.calls.some((call) => call.body?.action === "mark_pr")).toBe(false);
  });
  it("rechecks an open enrichment baseline against the latest main on every run", async () => {
    const edited = { ...library[0], summary: "Human-reviewed clarification." };
    const c = candidate({ proposal_kind: "enrich", target_example_id: edited.id, base_record_hash: hashDiscoveryRecord(library[0]), draft: edited, draft_hash: hashDiscoveryRecord(edited), approved_hash: hashDiscoveryRecord(edited), publication_status: "pr_open", pr_url: "https://github.com/hackshopdev/hackshop-mcp/pull/7", pr_head_sha: SHA_HEAD });
    const f = fixture({ publication: [c], existing: true });
    expect((await f.run())?.results[0].status).toBe("pr_open");
    f.state.movedMain = true; f.state.main = [{ ...library[0], summary: "A different edit was merged." }, ...library.slice(1)];
    expect((await f.run())?.results[0]).toMatchObject({ status: "blocked", error: "stale_enrichment_base" });
    expect(f.calls.filter((call) => call.url.endsWith("/git/ref/heads/main"))).toHaveLength(2);
  });
  it("verifies the queue CAS receipt rather than trusting a 200 response", async () => {
    const f = fixture({ approved: [candidate()] }); f.state.wrongReceipt = true;
    expect((await f.run())?.results[0]).toMatchObject({ status: "blocked", error: "invalid_queue_receipt" });
  });
  it("reconciles branch/PR creation races without overwriting references or opening duplicates", async () => {
    for (const race of ["raceRef", "racePull"] as const) {
      const f = fixture({ approved: [candidate()] }); f.state[race] = true;
      expect((await f.run())?.results[0].status).toBe("pr_open");
      expect(f.calls.filter((call) => call.url.endsWith("/git/refs") && call.method === "POST")).toHaveLength(1);
      expect(f.calls.filter((call) => call.url.endsWith("/pulls") && call.method === "POST")).toHaveLength(1);
      expect(f.calls.some((call) => call.method === "PATCH" || call.method === "DELETE")).toBe(false);
    }
  });
  it("marks live only after a merged PR, merged/main record hash, site hash and MCP hash all match", async () => {
    const c = candidate({ publication_status: "pr_open", pr_url: "https://github.com/hackshopdev/hackshop-mcp/pull/7", pr_head_sha: SHA_HEAD });
    const f = fixture({ publication: [c], existing: true, merged: true, main: [...library, draft] }); f.state.movedMain = true;
    expect((await f.run())?.results[0].status).toBe("site_live");
    expect(f.calls.find((call) => call.body?.action === "mark_live")?.body).toMatchObject({ id: c.id, version: 3, hash: c.approved_hash, merge_sha: SHA_MERGE, proof_urls: ["https://www.hackshop.dev/api/reverse-engineering-examples", "https://www.hackshop.dev/mcp"] });
    const mcp = f.calls.find((call) => new URL(call.url).pathname === "/mcp");
    expect(mcp?.body.params.name).toBe("find_reverse_engineering_examples");
    expect(f.calls.filter((call) => !call.url.includes("/api/discovery-worker")).every((call) => !call.headers.get("authorization")?.includes("worker-test-token"))).toBe(true);
    expect(f.calls.filter((call) => call.url.startsWith("https://www.hackshop.dev") && !call.url.includes("/api/discovery-worker")).every((call) => !call.headers.has("authorization"))).toBe(true);
  });
  it("does not conflate merged, deployment-pending, site-only and MCP-unavailable proof", async () => {
    const c = candidate({ publication_status: "pr_open", pr_url: "https://github.com/hackshopdev/hackshop-mcp/pull/7", pr_head_sha: SHA_HEAD });
    for (const fault of ["notMerged", "main", "site", "siteStatus", "mcp", "mcpError", "prHead"]) {
      const f = fixture({ publication: [c], existing: true, merged: true, main: [...library, draft] }); f.state.movedMain = true;
      if (fault === "notMerged") f.state.merged = false;
      if (fault === "main") f.state.main = library;
      if (fault === "site") f.state.site = library;
      if (fault === "siteStatus") f.state.siteStatus = 503;
      if (fault === "mcp") f.state.mcp = { ...f.state.mcp, summary: "old data" };
      if (fault === "mcpError") f.state.mcpError = true;
      if (fault === "prHead") f.state.prHead = "e".repeat(40);
      const result = await f.run();
      expect(result?.results[0]).toBeDefined();
      expect(result?.results[0].status).not.toBe("site_live");
      expect(f.calls.some((call) => call.body?.action === "mark_live")).toBe(false);
    }
  });
  it("refuses conflicting MCP text and structured proof and a wrong live receipt", async () => {
    const c = candidate({ publication_status: "pr_open", pr_url: "https://github.com/hackshopdev/hackshop-mcp/pull/7", pr_head_sha: SHA_HEAD });
    const f = fixture({ publication: [c], existing: true, merged: true, main: [...library, draft] }); f.state.movedMain = true;
    f.state.mcpText = { ...f.state.mcp, summary: "Different text-client record" };
    expect((await f.run())?.results[0]).toMatchObject({ status: "blocked", error: "mcp_response_conflict" });
    expect(f.calls.some((call) => call.body?.action === "mark_live")).toBe(false);
    f.state.mcpText = null; f.state.wrongLiveReceipt = true;
    expect((await f.run())?.results[0]).toMatchObject({ status: "blocked", error: "invalid_queue_receipt" });
  });
  it("bounds the MCP verification query even for a long valid reviewed title", async () => {
    const long = { ...draft, title: "A".repeat(3000) };
    const c = candidate({ draft: long, draft_hash: hashDiscoveryRecord(long), approved_hash: hashDiscoveryRecord(long), publication_status: "pr_open", pr_url: "https://github.com/hackshopdev/hackshop-mcp/pull/7", pr_head_sha: SHA_HEAD });
    const f = fixture({ publication: [c], existing: true, merged: true, main: [...library, long] }); f.state.movedMain = true;
    expect((await f.run())?.results[0].status).toBe("site_live");
    expect(f.calls.find((call) => new URL(call.url).pathname === "/mcp")?.body.params.arguments.query.length).toBeLessThanOrEqual(2000);
  });
  it("runs only a trusted-main, non-fork scheduled/manual publisher with bounded permissions", () => {
    let workflow = "";
    try { workflow = readFileSync(".github/workflows/promote-hardware-discoveries.yml", "utf8"); } catch { /* Missing implementation is RED. */ }
    expect(workflow).toContain('cron: "17,47 * * * *"');
    expect(workflow).toContain("github.ref == 'refs/heads/main'");
    expect(workflow).toContain("github.repository == 'hackshopdev/hackshop-mcp'");
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("contents: write");
    expect(workflow).toContain("pull-requests: write");
    expect(workflow).toContain('node-version: "22"');
    expect(workflow).toContain("npm ci");
    expect(workflow).toContain("DISCOVERY_WORKER_TOKEN");
    expect(workflow).toContain("cancel-in-progress: false");
    expect(workflow).toContain("persist-credentials: false");
    expect(workflow).not.toMatch(/pull_request_target|pull_request:|auto-merge|SUPABASE_SECRET_KEY|gh pr merge/);
  });
});
