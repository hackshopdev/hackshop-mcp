import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Catalog } from "../../src/catalog/schema.js";
import { ReverseEngineeringExampleCatalog, type ReverseEngineeringExample } from "../../src/core/reverse-engineering.js";
import { reverseEngineeringExampleSummary } from "../../src/core/reverse-engineering-tools.js";
import * as contractModule from "../../site/lib/discoveries/types.js";
import * as hashModule from "../../site/lib/discoveries/hash.js";
import type { DiscoveryCandidate, WorkerRequest } from "../../site/lib/discoveries/types.js";

// tsx resolves the website's package as CommonJS; Vitest resolves it as ESM.
const contract = ((contractModule as any).default ?? contractModule) as typeof import("../../site/lib/discoveries/types.js");
const { hashDiscoveryRecord, canonicalJson } = ((hashModule as any).default ?? hashModule) as typeof import("../../site/lib/discoveries/hash.js");
const REPOSITORY = "hackshopdev/hackshop-mcp";
const API = `https://api.github.com/repos/${REPOSITORY}`;
const WORKER = "https://www.hackshop.dev/api/discovery-worker";
const PROOF_URLS = ["https://www.hackshop.dev/api/reverse-engineering-examples", "https://www.hackshop.dev/mcp"];
const DATA_PATHS = ["reverse-engineering-examples.json", "site/reverse-engineering-examples.json"];
const PUBLICATION_STATES = ["approved", "pr_open", "merged", "verification_failed", "site_live"];
const SHA = /^[a-f0-9]{40,64}$/;
const sha = (value: unknown): string => {
  if (typeof value !== "string" || !SHA.test(value)) throw new Error("invalid_github_sha");
  return value;
};

export function validateApprovedCandidate(value: unknown, states = ["approved"]): DiscoveryCandidate {
  const candidate = contract.DiscoveryCandidateSchema.parse(value);
  if (!states.includes(candidate.publication_status) || candidate.research_status !== "ready_for_review" ||
      !candidate.draft || !candidate.approved_at || candidate.unresolved_claims.length !== 0 ||
      !candidate.approved_hash || candidate.approved_hash !== candidate.draft_hash ||
      candidate.approved_version !== candidate.draft_version ||
      hashDiscoveryRecord(candidate.draft) !== candidate.approved_hash) throw new Error("stale_approved_snapshot");
  // Hash the original too: parsing must never silently strip or default approved content.
  if (hashDiscoveryRecord((value as DiscoveryCandidate).draft) !== candidate.approved_hash) throw new Error("noncanonical_approved_draft");
  return candidate;
}

function validateLibrary(examples: unknown, catalog: unknown): ReverseEngineeringExample[] {
  const devices = Catalog.parse(catalog);
  const ids = new Set(devices.map((device) => device.id));
  if (ids.size !== devices.length) throw new Error("duplicate_catalog_device");
  const parsed = ReverseEngineeringExampleCatalog.parse(examples);
  for (const record of parsed) for (const id of record.catalog_device_ids) {
    if (!ids.has(id)) throw new Error("unknown_catalog_device");
  }
  return examples as ReverseEngineeringExample[];
}

export function buildPromotion(value: unknown, examples: unknown, catalog: unknown): ReverseEngineeringExample[] {
  const candidate = validateApprovedCandidate(value, PUBLICATION_STATES);
  const records = validateLibrary(examples, catalog);
  const draft = candidate.draft!;
  if (candidate.proposal_kind === "new") {
    if (candidate.target_example_id !== null) throw new Error("new_record_has_target");
    if (records.some((record) => record.id === draft.id)) throw new Error("example_id_collision");
    return validateLibrary([...records, draft], catalog);
  }
  if (candidate.target_example_id !== draft.id) throw new Error("enrichment_id_mismatch");
  const original = records.find((record) => record.id === candidate.target_example_id);
  if (!original) throw new Error("enrichment_target_missing");
  if (!candidate.base_record_hash || hashDiscoveryRecord(original) !== candidate.base_record_hash) throw new Error("stale_enrichment_base");
  if (hashDiscoveryRecord(original) === candidate.approved_hash) throw new Error("no_record_change");
  return validateLibrary(records.map((record) => record.id === draft.id ? draft : record), catalog);
}

type Options = { githubToken: string; workerToken: string; fetch?: typeof fetch; now?: Date };
type Pull = { number: number; html_url: string; state: string; merged?: boolean; merge_commit_sha?: string | null; head: { ref: string; sha: string; repo: { full_name: string } }; base: { ref: string; repo: { full_name: string } } };
type Snapshot = { examples: ReverseEngineeringExample[]; catalog: unknown; content: string };
type Result = { id: string; status: "pr_open" | "site_live" | "deployment_pending" | "blocked"; pr_url?: string; error?: string };

class HttpError extends Error {
  constructor(public status: number, code: string) { super(code); }
}
async function responseJson(response: Response): Promise<any> {
  if (Number(response.headers.get("content-length") ?? 0) > 4_000_000) throw new Error("response_too_large");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("empty_response");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 4_000_000) throw new Error("response_too_large");
      chunks.push(part.value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new Error("invalid_json_response"); }
}

function client(options: Options) {
  if (!options.githubToken || !options.workerToken) throw new Error("missing_publisher_credentials");
  const request = options.fetch ?? fetch;
  async function call(url: string, scope: "github" | "worker" | "public", method = "GET", body?: unknown) {
    const headers: Record<string, string> = { accept: "application/json", "cache-control": "no-cache" };
    if (scope === "github") {
      headers.authorization = `Bearer ${options.githubToken}`;
      headers.accept = "application/vnd.github+json";
      headers["x-github-api-version"] = "2026-03-10";
    }
    if (scope === "worker") headers.authorization = `Bearer ${options.workerToken}`;
    if (body !== undefined) headers["content-type"] = "application/json";
    if (url === PROOF_URLS[1]) headers.accept = "application/json, text/event-stream";
    let response: Response;
    try { response = await request(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: "error", cache: "no-store", signal: AbortSignal.timeout(20_000) }); }
    catch { throw new Error(`${scope}_transport_failed`); }
    const data = await responseJson(response);
    if (!response.ok) {
      const code = scope === "worker" && typeof data?.error === "string" && /^[a-z_]{1,100}$/.test(data.error) ? `worker_${data.error}` : `${scope}_http_${response.status}`;
      throw new HttpError(response.status, code);
    }
    return data;
  }
  const github = (path: string, method = "GET", body?: unknown) => call(`${API}${path}`, "github", method, body);
  const worker = (input: WorkerRequest) => call(WORKER, "worker", "POST", contract.WorkerRequest.parse(input));
  async function readCandidates(action: "read_approved" | "read_publication") {
    const data = await worker({ action });
    if (!data || !Array.isArray(data.candidates) || data.candidates.length > 100) throw new Error("invalid_queue_response");
    try { return data.candidates.map((row: unknown) => contract.DiscoveryCandidateSchema.parse(row)); }
    catch { throw new Error("invalid_queue_response"); }
  }
  async function file(path: string, ref: string): Promise<string> {
    const data = await github(`/contents/${path}?ref=${encodeURIComponent(sha(ref))}`);
    if (data?.type !== "file" || data.encoding !== "base64" || typeof data.content !== "string" || data.content.length > 3_000_000) throw new Error("invalid_github_file");
    return Buffer.from(data.content, "base64").toString("utf8");
  }
  async function snapshot(ref: string): Promise<Snapshot> {
    const reads = await Promise.allSettled([file(DATA_PATHS[0]!, ref), file(DATA_PATHS[1]!, ref), file("catalog.json", ref)]);
    for (const read of reads) if (read.status === "rejected") throw read.reason;
    const [root, mirror, catalogText] = reads.map((read) => (read as PromiseFulfilledResult<string>).value) as [string, string, string];
    if (root !== mirror) throw new Error("main_mirror_drift");
    let examples: unknown, catalog: unknown;
    try { examples = JSON.parse(root); catalog = JSON.parse(catalogText); } catch { throw new Error("invalid_repository_json"); }
    return { examples: validateLibrary(examples, catalog), catalog, content: root };
  }
  async function main() {
    const ref = await github("/git/ref/heads/main");
    const head = sha(ref?.object?.sha);
    const commit = await github(`/git/commits/${head}`);
    return { sha: head, tree: sha(commit?.tree?.sha), ...await snapshot(head) };
  }
  async function branchHead(branch: string): Promise<string | null> {
    try { return sha((await github(`/git/ref/heads/${branch}`))?.object?.sha); }
    catch (error) { if (error instanceof HttpError && error.status === 404) return null; throw error; }
  }
  function checkPull(value: any, branch: string): Pull {
    if (!value || !Number.isSafeInteger(value.number) || value.number < 1 ||
        value.html_url !== `https://github.com/${REPOSITORY}/pull/${value.number}` ||
        value.head?.ref !== branch || value.head?.repo?.full_name !== REPOSITORY ||
        value.base?.ref !== "main" || value.base?.repo?.full_name !== REPOSITORY ||
        !["open", "closed"].includes(value.state)) throw new Error("unexpected_pull_request");
    sha(value.head.sha);
    return value;
  }
  async function findPull(branch: string): Promise<Pull | null> {
    const list = await github(`/pulls?state=all&head=${encodeURIComponent(`hackshopdev:${branch}`)}&base=main&per_page=100`);
    if (!Array.isArray(list) || list.length > 1) throw new Error("ambiguous_pull_request");
    if (!list.length) return null;
    const found = checkPull(list[0], branch);
    return checkPull(await github(`/pulls/${found.number}`), branch);
  }
  async function verifyBranch(candidate: DiscoveryCandidate, head: string) {
    const commit = await github(`/git/commits/${sha(head)}`);
    if (!Array.isArray(commit.parents) || commit.parents.length !== 1) throw new Error("unsafe_branch_history");
    const parent = sha(commit.parents[0]?.sha);
    const compare = await github(`/compare/${parent}...${head}`);
    if (!Array.isArray(compare.files) || compare.files.length !== 2 ||
        compare.files.some((entry: any) => !DATA_PATHS.includes(entry.filename) || entry.status !== "modified") ||
        new Set(compare.files.map((entry: any) => entry.filename)).size !== 2) throw new Error("unsafe_branch_diff");
    const reads = await Promise.allSettled([snapshot(parent), snapshot(head)]);
    for (const read of reads) if (read.status === "rejected") throw read.reason;
    const [base, proposed] = reads.map((read) => (read as PromiseFulfilledResult<Snapshot>).value) as [Snapshot, Snapshot];
    const expected = buildPromotion(candidate, base.examples, base.catalog);
    if (canonicalJson(proposed.examples) !== canonicalJson(expected)) throw new Error("branch_snapshot_mismatch");
  }
  function checkDiff(files: unknown, error: string) {
    if (!Array.isArray(files) || files.length !== 2 ||
        files.some((entry: any) => !DATA_PATHS.includes(entry.filename) || entry.status !== "modified") ||
        new Set(files.map((entry: any) => entry.filename)).size !== 2) throw new Error(error);
  }
  async function verifyPullDiff(pull: Pull) {
    checkDiff(await github(`/pulls/${pull.number}/files?per_page=100`), "unsafe_pull_diff");
  }
  function verifyReceipt(response: any, candidate: DiscoveryCandidate, state: string, fields: Record<string, unknown>) {
    let row: DiscoveryCandidate;
    try { row = validateApprovedCandidate(response?.candidate, [state]); } catch { throw new Error("invalid_queue_receipt"); }
    if (row.id !== candidate.id || row.approved_hash !== candidate.approved_hash || row.approved_version !== candidate.approved_version ||
        Object.entries(fields).some(([key, value]) => canonicalJson(row[key]) !== canonicalJson(value))) throw new Error("invalid_queue_receipt");
  }
  async function markPr(candidate: DiscoveryCandidate, pull: Pull) {
    const response = await worker({ action: "mark_pr", id: candidate.id, hash: candidate.approved_hash!, version: candidate.approved_version!, pr_url: pull.html_url, pr_head_sha: sha(pull.head.sha) });
    verifyReceipt(response, candidate, "pr_open", { pr_url: pull.html_url, pr_head_sha: pull.head.sha });
  }
  async function verifyDeployment(candidate: DiscoveryCandidate, pull: Pull, current: Snapshot): Promise<Result> {
    if (!pull.merged || pull.state !== "closed") {
      if (pull.state === "closed") throw new Error("pr_closed_unmerged");
      return { id: candidate.id, status: "pr_open", pr_url: pull.html_url };
    }
    if (candidate.pr_head_sha && candidate.pr_head_sha !== pull.head.sha) throw new Error("pr_head_changed");
    const merge = sha(pull.merge_commit_sha);
    const merged = await snapshot(merge);
    const matchesHash = (records: ReverseEngineeringExample[]) => {
      const record = records.find((row) => row.id === candidate.draft!.id);
      return !!record && hashDiscoveryRecord(record) === candidate.approved_hash;
    };
    if (!matchesHash(merged.examples)) throw new Error("merged_record_mismatch");
    if (!matchesHash(current.examples)) throw new Error("main_record_superseded");
    const site = await call(PROOF_URLS[0]!, "public");
    const publicRecords = ReverseEngineeringExampleCatalog.parse(site?.examples);
    if (!matchesHash(publicRecords)) return { id: candidate.id, status: "deployment_pending", pr_url: pull.html_url, error: "site_record_pending" };
    const mcp = await call(PROOF_URLS[1]!, "public", "POST", { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "find_reverse_engineering_examples", arguments: { query: candidate.draft!.title.slice(0, 2000), limit: 50 } } });
    if (mcp?.error || mcp?.result?.isError || mcp?.jsonrpc !== "2.0" || mcp?.id !== 1) throw new Error("mcp_verification_unavailable");
    let result = mcp.result?.structuredContent;
    const text = mcp.result?.content?.find((entry: any) => entry.type === "text" && typeof entry.text === "string")?.text;
    if (text !== undefined) {
      let textResult: unknown;
      try { textResult = JSON.parse(text); } catch { throw new Error("invalid_mcp_response"); }
      if (result && canonicalJson(result) !== canonicalJson(textResult)) throw new Error("mcp_response_conflict");
      result ??= textResult;
    }
    if (!Array.isArray(result?.matches)) throw new Error("invalid_mcp_response");
    const record = result.matches.find((row: any) => row?.id === candidate.draft!.id);
    // MCP summaries explicitly materialize null/empty optional fields. Compare the
    // exact canonical summary, then restore only those known defaults for the full
    // approved-record hash; unknown fields and changed claims cannot be ignored.
    if (!record || hashDiscoveryRecord(record) !== hashDiscoveryRecord(reverseEngineeringExampleSummary(candidate.draft!))) return { id: candidate.id, status: "deployment_pending", pr_url: pull.html_url, error: "mcp_record_pending" };
    const full = { ...record };
    for (const key of ["published_at", "price", "design_ideas"] as const) if (!(key in candidate.draft!)) delete full[key];
    if (hashDiscoveryRecord(full) !== candidate.approved_hash) throw new Error("mcp_record_hash_mismatch");
    const response = await worker({ action: "mark_live", id: candidate.id, hash: candidate.approved_hash!, version: candidate.approved_version!, merge_sha: merge, verified_at: (options.now ?? new Date()).toISOString(), proof_urls: PROOF_URLS });
    verifyReceipt(response, candidate, "site_live", { merge_sha: merge, proof_urls: PROOF_URLS });
    return { id: candidate.id, status: "site_live", pr_url: pull.html_url };
  }
  async function promote(value: DiscoveryCandidate): Promise<Result> {
    const candidate = validateApprovedCandidate(value, PUBLICATION_STATES);
    const branch = `codex/discovery-${candidate.id}-${candidate.approved_hash!.slice(0, 12)}`;
    // Every candidate gets a new immutable main snapshot, never the runner checkout.
    const current = await main();
    let pull = await findPull(branch);
    if (candidate.publication_status !== "approved") {
      if (!candidate.pr_url || !candidate.pr_head_sha || !pull || candidate.pr_url !== pull.html_url || candidate.pr_head_sha !== pull.head.sha) throw new Error("pr_head_changed");
      if (!pull.merged && pull.state === "open") buildPromotion(candidate, current.examples, current.catalog);
      await verifyBranch(candidate, pull.head.sha);
      await verifyPullDiff(pull);
      return verifyDeployment(candidate, pull, current);
    }
    if (pull?.state === "closed" && !pull.merged) throw new Error("pr_closed_unmerged");
    if (pull?.merged) {
      await verifyBranch(candidate, pull.head.sha);
      await verifyPullDiff(pull);
      await markPr(candidate, pull);
      return verifyDeployment({ ...candidate, pr_head_sha: pull.head.sha }, pull, current);
    }
    const records = buildPromotion(candidate, current.examples, current.catalog);
    let head = await branchHead(branch);
    if (!head) {
      if (pull) throw new Error("pull_branch_missing");
      const content = JSON.stringify(records, null, 2) + "\n";
      const tree = await github("/git/trees", "POST", { base_tree: current.tree, tree: DATA_PATHS.map((path) => ({ path, mode: "100644", type: "blob", content })) });
      const commit = await github("/git/commits", "POST", { message: `Add reviewed hardware discovery ${candidate.id}`, tree: sha(tree?.sha), parents: [current.sha] });
      head = sha(commit?.sha);
      try { await github("/git/refs", "POST", { ref: `refs/heads/${branch}`, sha: head }); }
      catch (error) {
        if (!(error instanceof HttpError) || error.status !== 422) throw error;
        head = await branchHead(branch);
        if (!head) throw new Error("branch_creation_conflict");
      }
    }
    await verifyBranch(candidate, head);
    // Without a PR, compare the entire branch against main, not just its last
    // commit; an orphaned/malicious ancestor must not smuggle code into a new PR.
    if (!pull) checkDiff((await github(`/compare/${current.sha}...${head}`)).files, "unsafe_branch_diff");
    if (pull && pull.head.sha !== head) throw new Error("pr_head_changed");
    if (!pull) {
      const body = `Human-reviewed hardware library draft. Manual merge is required; this publisher never enables auto-merge.\n\nCandidate: ${candidate.id}\nApproved version: ${candidate.approved_version}\nApproved SHA-256: ${candidate.approved_hash}\nProposal: ${candidate.proposal_kind}\n\nOnly the two mirrored reverse-engineering example JSON files may change. No private sources, queue records or credentials are published. After manual merge, website and hosted MCP record hashes must both match before the queue is marked live.`;
      try { pull = checkPull(await github("/pulls", "POST", { title: `Hardware discovery: ${candidate.draft!.title.slice(0, 150)}`, head: branch, base: "main", body, maintainer_can_modify: false }), branch); }
      catch (error) {
        if (!(error instanceof HttpError) || error.status !== 422) throw error;
        pull = await findPull(branch);
        if (!pull) throw new Error("pull_creation_conflict");
      }
    }
    // Re-read the PR after creation/reconciliation before the queue's CAS write.
    pull = checkPull(await github(`/pulls/${pull.number}`), branch);
    if (pull.head.sha !== head) throw new Error("pr_head_changed");
    if (pull.state !== "open") throw new Error("pull_state_changed");
    await verifyPullDiff(pull);
    await markPr(candidate, pull);
    return { id: candidate.id, status: "pr_open", pr_url: pull.html_url };
  }
  return { readCandidates, promote };
}

export async function runPromotion(options: Options): Promise<{ results: Result[]; deferred: number }> {
  const publisher = client(options);
  const reads = await Promise.allSettled([publisher.readCandidates("read_approved"), publisher.readCandidates("read_publication")]);
  for (const read of reads) if (read.status === "rejected") throw read.reason;
  const [approved, publication] = reads.map((read) => (read as PromiseFulfilledResult<DiscoveryCandidate[]>).value);
  const rows = [...approved!, ...publication!];
  if (new Set(rows.map((row) => row.id)).size !== rows.length) throw new Error("duplicate_queue_candidate");
  const results: Result[] = [];
  for (const candidate of rows.slice(0, 25)) {
    try { results.push(await publisher.promote(candidate)); }
    catch (error) {
      const message = error instanceof Error && /^[a-z_0-9]{1,100}$/.test(error.message) ? error.message : "invalid_promotion_data";
      results.push({ id: candidate.id, status: "blocked", error: message });
    }
  }
  return { results, deferred: Math.max(0, rows.length - results.length) };
}

async function main() {
  if (!process.argv.includes("--live")) { console.log(JSON.stringify({ executed: false, mode: "approval-only", instruction: "Use --live with trusted-main publisher credentials after deployment." })); return; }
  if (process.env.DISCOVERY_PIPELINE_ENABLED !== "true") throw new Error("pipeline_not_enabled");
  if (process.env.GITHUB_REPOSITORY !== REPOSITORY || process.env.GITHUB_REF !== "refs/heads/main") throw new Error("trusted_main_required");
  const result = await runPromotion({ githubToken: process.env.GITHUB_TOKEN ?? "", workerToken: process.env.DISCOVERY_WORKER_TOKEN ?? "" });
  console.log(JSON.stringify(result));
  if (result.results.some((row) => row.status === "blocked")) process.exitCode = 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error instanceof Error && /^[a-z_0-9]{1,100}$/.test(error.message) ? error.message : "promotion_failed"); process.exitCode = 1; });
