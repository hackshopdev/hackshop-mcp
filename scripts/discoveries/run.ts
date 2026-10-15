import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ReverseEngineeringExampleCatalog, type ReverseEngineeringExample } from "../../src/core/reverse-engineering.js";
import * as contractModule from "../../site/lib/discoveries/types.js";
import { canonicalSourceUrl, digest, existingIdentityIndex, githubProject, normalizePost, projectKey, type DiscoveredPost } from "./canonicalize.js";
import { createScrapeCreatorsClient, SCRAPECREATORS_COVERAGE_NOTE } from "./scrapecreators.js";
import { harvestGrokCliResult, sendGrokCliRequest, type GrokCli } from "./grok.js";
import { researchPost, type ResearchDocument } from "./research.js";
import { isHardwarePost, rankHardwarePosts } from "./relevance.js";
import { createWorkerClient, type WorkerClient } from "./queue.js";

const QuerySchema = z.array(z.object({ id: z.string().regex(/^[a-z0-9-]+$/), query: z.string().min(3).max(500) }).strict()).length(6);
type Query = z.infer<typeof QuerySchema>[number];
const { IngestItem } = ((contractModule as any).default ?? contractModule) as typeof import("../../site/lib/discoveries/types.js");
type Ingest = z.infer<typeof IngestItem>;
const LIMIT = 5;

export function discoveryWindow(now: Date) {
  const backfill = now.getUTCDay() === 0;
  return { start: new Date(now.valueOf() - (backfill ? 14 * 24 : 72) * 3_600_000).toISOString(), end: now.toISOString(), backfill };
}

function initialItem(post: DiscoveredPost, queueProjectKey?: string): Ingest {
  const url = canonicalSourceUrl(post.url);
  const kind = url.startsWith("https://x.com/i/status/") ? "social_post" : githubProject(url) ? "repo" : "guide";
  return IngestItem.parse({
    project_key: queueProjectKey ?? projectKey([...post.links, post.url]),
    source: { url, label: "Public hardware discovery", kind, author: post.author ?? null, published_at: post.publishedAt ?? null, excerpt: post.text.slice(0, 1200) },
    status: "discovered", research_notes: "Public claim awaiting exact-model and primary-source research.",
  });
}

function postFromPending(candidate: { sources: Array<{ url: string; excerpt: string; author: string | null; published_at: string | null }> }): DiscoveredPost | undefined {
  const source = candidate.sources.find((source) => /^https:\/\/(?:x\.com|twitter\.com)\//.test(source.url)) ?? candidate.sources[0];
  if (!source) return;
  if (/^https:\/\/(?:x\.com|twitter\.com)\//.test(source.url)) {
    const post = normalizePost({ url: source.url, rest_id: source.url.match(/status\/(\d+)/)?.[1], full_text: source.excerpt || "Hardware post submitted for research", created_at: source.published_at, author: source.author });
    if (post) post.links = [...new Set([...post.links, ...candidate.sources.filter((other) => !/^https:\/\/(?:x\.com|twitter\.com)\//.test(other.url)).map((other) => other.url)])].slice(0, 24);
    return post;
  }
  try {
    const url = canonicalSourceUrl(source.url);
    return { id: `primary-${digest(url).slice(0, 20)}`, url, text: source.excerpt || "Primary source submitted for research", links: [url], ...(source.author ? { author: source.author } : {}), ...(source.published_at ? { publishedAt: source.published_at } : {}) };
  } catch { return; }
}

const SeedSchema = z.object({ id: z.string().max(60), url: z.string().max(2048), text: z.string().max(20_000), links: z.array(z.string().max(2048)).max(24), author: z.string().max(30).optional(), publishedAt: z.string().optional() });

export async function runDiscovery(options: {
  queue: WorkerClient; queries: Query[]; examples: ReverseEngineeringExample[]; now: Date; leaseOwner: string;
  scrapeKey?: string; providerFetch?: typeof fetch; fetchText?: (url: string) => Promise<ResearchDocument>;
  grok?: { cli?: GrokCli; env?: Record<string, string | undefined> };
}) {
  QuerySchema.parse(options.queries);
  const window = discoveryWindow(options.now);
  const runKey = `hardware-discovery:${options.now.toISOString().slice(0, 10)}`;
  const begun = await options.queue.begin({ run_key: runKey, window_start: window.start, window_end: window.end, lease_owner: options.leaseOwner });
  if (begun.replayed && begun.run.status !== "running") return { status: "replayed", run_id: begun.run.id };
  const run = begun.run;
  const lease = { run_id: run.id, lease_owner: options.leaseOwner };
  const checkpoints = { ...run.checkpoints } as Record<string, any>;
  const calls = { ...(checkpoints.calls ?? {}) } as Record<string, Record<string, unknown>>;
  const providers = { ...run.provider_status };
  const coverage = [SCRAPECREATORS_COVERAGE_NOTE, `Window ${window.start} through ${window.end}; ${window.backfill ? "bounded 14-day Sunday backfill" : "72-hour overlap"}. At most five candidates and eight primary-source fetches per candidate.`];
  let budgetExhausted = false;
  let partial = false;
  let selectedCount = 0;
  const identity = existingIdentityIndex(options.examples);
  const byId = new Map(options.examples.map((example) => [example.id, example]));
  async function checkpoint() { await options.queue.checkpoint({ ...lease, patch: { checkpoints: { ...checkpoints, calls }, provider_status: providers, coverage_notes: coverage.slice(0, 30).map((note) => note.slice(0, 600)) } }); }
  try {
    const pending = await options.queue.pending();
    const suggestions: DiscoveredPost[] = (Array.isArray(checkpoints.discovered_posts) ? checkpoints.discovered_posts : []).flatMap((seed) => {
      const parsed = SeedSchema.safeParse(seed); return parsed.success ? [parsed.data] : [];
    }).slice(0, LIMIT);
    const queuedSources = new Set(pending.candidates.flatMap((candidate) => candidate.sources.map((source) => canonicalSourceUrl(source.url))));
    // Store only five small public seeds, not full provider objects or repeated
    // arrays in every call receipt. Together with receipts this remains below
    // the worker's 16KB checkpoint bound, even for multibyte author text.
    function rememberSeeds(posts: DiscoveredPost[]) {
      const stored = new Map<string, DiscoveredPost>((checkpoints.discovered_posts ?? []).map((post: DiscoveredPost) => [post.id, post]));
      for (const post of posts) {
        if (!isHardwarePost(post) || identity.sources.has(canonicalSourceUrl(post.url)) || queuedSources.has(canonicalSourceUrl(post.url)) || (post.publishedAt && (post.publishedAt < window.start || post.publishedAt > window.end))) continue;
        stored.set(post.id, post);
      }
      // Later device-specific queries can displace early commentary from the
      // recoverable five-seed window, without retaining full provider replies.
      checkpoints.discovered_posts = rankHardwarePosts([...stored.values()].filter(isHardwarePost)).slice(0, LIMIT)
        .map((post) => ({ ...post, text: post.text.slice(0, 250), links: post.links.filter((link) => link.length <= 256).slice(0, 2) }));
    }
    const harvestedProjects = new Set<string>();
    const knownRequests = new Set(pending.runs.map((old) => old.grok_receipt?.request_id).filter(Boolean));
    if (run.grok_receipt) knownRequests.add(run.grok_receipt.request_id);
    // Collect terminal results from older asynchronous jobs before deciding
    // whether this daily run may submit one new request.
    if (options.grok) {
      const waiting = pending.runs.filter((old) => old.checkpoints.grok_transport !== "gateway" && old.grok_receipt && old.grok_receipt.provider !== "xai_gateway" && ["sending", "send_unknown", "accepted", "pending"].includes(old.grok_receipt.status))
        .sort((a, b) => a.grok_receipt!.request_id.localeCompare(b.grok_receipt!.request_id));
      // Rotate the bounded read window by UTC day: a permanently pending oldest
      // batch must not prevent newer completed receipts from being harvested.
      const offset = waiting.length ? (Math.floor(options.now.valueOf() / 86_400_000) * 10) % waiting.length : 0;
      const oldReceipts = [...waiting.slice(offset), ...waiting.slice(0, offset)].slice(0, 10);
      for (const old of oldReceipts) {
        try {
          await harvestGrokCliResult({ requestId: old.grok_receipt!.request_id, cli: options.grok.cli, env: options.grok.env,
            ingest: async (result, hash, status) => {
              // Queue every bounded result before terminal state. LIMIT applies
              // to costly research below, not to retaining completed leads.
              const receiptProjects = new Set<string>();
              const unique = result.posts.filter((post) => {
                const key = projectKey([...post.links, post.url]);
                if (!isHardwarePost(post) || identity.sources.has(canonicalSourceUrl(post.url)) || queuedSources.has(canonicalSourceUrl(post.url)) || harvestedProjects.has(key) || receiptProjects.has(key)) return false;
                receiptProjects.add(key); return true;
              });
              const ingested = await options.queue.harvest({ request_id: old.grok_receipt!.request_id, status, result_hash: hash, items: unique.map((post) => initialItem(post)) });
              for (const key of receiptProjects) harvestedProjects.add(key);
              pending.candidates.push(...(ingested.candidates ?? []));
              suggestions.push(...unique);
              coverage.push(result.coverage_note.slice(0, 600));
            }, complete: async () => {},
          });
        } catch { partial = true; coverage.push(`Could not check saved relay receipt ${old.grok_receipt!.request_id}; receipt retained and request not resent.`); }
      }
    }
    const requestId = `discovery_${options.now.toISOString().slice(0, 10).replaceAll("-", "")}`;
    const researchTask = `Research current public X posts about hardware reverse engineering, cheap displays for calendars/AI/info panels, local-control lighting, firmware replacements and owner-device repurposing. Window ${window.start} to ${window.end}. Return at most five direct original post URLs plus linked primary repositories/guides, author, posted_at, factual note and coverage_note. Distinguish author demonstrations from independent physical proof, and do not infer exact model compatibility. Public content only; do not post, message or execute code.`;
    let client: ReturnType<typeof createScrapeCreatorsClient> | undefined;
    if (options.scrapeKey) {
      client = createScrapeCreatorsClient({ apiKey: options.scrapeKey, fetch: options.providerFetch,
        reserve: async (key) => {
          if (calls[key]) return { allowed: true, replayed: true };
          return options.queue.reserve(run.id, key);
        },
        settle: async (key, charged) => { await options.queue.settle(run.id, key, charged); },
        checkpoint: async (key, state, detail) => {
          const { posts, ...receipt } = detail ?? {};
          if (Array.isArray(posts)) rememberSeeds(posts as DiscoveredPost[]);
          calls[key] = { state, ...receipt }; await checkpoint();
        },
      });
      const balance = await client.balance("scrape:balance");
      if (balance.status === "budget_exhausted") budgetExhausted = true;
      else if (balance.status !== "completed" && balance.status !== "replayed") { partial = true; providers.scrapecreators = balance.status; }
      const knownBalance = Number(balance.data?.creditCount);
      if (Number.isFinite(knownBalance) && knownBalance <= 0) { budgetExhausted = true; providers.scrapecreators = "no_credits"; }
      if (!budgetExhausted) for (const [index, query] of options.queries.entries()) {
        const datedQuery = `${query.query} after:${window.start.slice(0, 10)} before:${new Date(options.now.valueOf() + 86_400_000).toISOString().slice(0, 10)}`;
        const result = await client.search(`scrape:search:${index}`, datedQuery);
        if (result.status === "budget_exhausted") { budgetExhausted = true; break; }
        if (result.status === "completed") suggestions.push(...(result.posts ?? []).filter((post) => !post.publishedAt || (post.publishedAt >= window.start && post.publishedAt <= window.end)));
        else { partial = true; }
      }
      providers.scrapecreators = budgetExhausted ? "budget_exhausted" : partial ? "partial" : "completed";
    } else { partial = true; providers.scrapecreators = "unavailable_missing_credentials"; coverage.push("ScrapeCreators credentials unavailable; no paid calls attempted."); }

    // Manual primary URLs are free source reads, and do not require social
    // scraping credentials. A human Needs research action increments the draft
    // version and sets researching; needs_evidence alone does not cause daily
    // automatic re-research of the same unresolved claim.
    const jobs = new Map<string, { post: DiscoveredPost; researchKey: string; candidate?: (typeof pending.candidates)[number] }>();
    for (const candidate of pending.candidates) {
      if (candidate.publication_status !== "unreviewed" || !["discovered", "hydrated", "researching", "retryable_failed"].includes(candidate.research_status)) continue;
      const post = postFromPending(candidate);
      if (post && !identity.sources.has(canonicalSourceUrl(post.url))) jobs.set(post.id, { post, candidate, researchKey: candidate.id ? `research:${candidate.id}:${candidate.draft_version ?? 1}` : `research:${post.id}` });
    }
    for (const post of rankHardwarePosts(suggestions.filter(isHardwarePost))) {
      if (!identity.sources.has(canonicalSourceUrl(post.url)) && !queuedSources.has(canonicalSourceUrl(post.url)) && !jobs.has(post.id)) jobs.set(post.id, { post, researchKey: `research:${post.id}` });
    }
    const projects = new Set<string>();
    const selected = [...jobs.values()].filter(({ post, researchKey }) => {
      if (checkpoints[researchKey]) return false;
      const key = projectKey([...post.links, post.url]);
      if (projects.has(key)) return false;
      projects.add(key); return true;
    }).slice(0, LIMIT);
    selectedCount = selected.length;
    if (jobs.size > LIMIT) { partial = true; coverage.push(`Selected ${LIMIT} research jobs from ${jobs.size} sources; additional suggestions remain outside this bounded run.`); }
    let hydrationCount = 0;
    for (const { post: initial, researchKey, candidate } of selected) {
      let post = initial;
      if (/^https:\/\/x\.com\/i\/status\//.test(initial.url)) {
        const hydration = !client ? { status: "unavailable" as const } : budgetExhausted ? { status: "budget_exhausted" as const } : await client.hydrate(`scrape:hydrate:${hydrationCount++}`, initial.url);
        if (hydration.status === "budget_exhausted") budgetExhausted = true;
        if (hydration.status === "completed") {
          const hydrated = normalizePost({ ...hydration.data, url: initial.url });
          if (hydrated) post = { ...hydrated, links: [...new Set([...hydrated.links, ...initial.links])].slice(0, 24) };
          rememberSeeds([post]); await checkpoint();
        } else partial = true;
      }
      // Mark before source fetches. A process restart must not silently repeat
      // all eight reads or replay an ambiguous provider hydration.
      checkpoints[researchKey] = "started"; await checkpoint();
      const starter = initialItem(post, candidate?.project_key);
      // Queue identity is immutable once a URL is assigned. Hydration may
      // reveal a repository, but must not silently reassign an existing URL.
      // A started attempt is put into needs_evidence before free fetches, so
      // a later-day restart needs a distinct human request rather than retrying
      // an ambiguous research attempt automatically.
      await options.queue.ingest({ ...lease, items: [IngestItem.parse({ ...starter,
        project_key: candidate?.project_key ?? starter.project_key,
        proposal_kind: candidate?.proposal_kind ?? "new",
        ...(candidate?.target_example_id ? { target_example_id: candidate.target_example_id } : {}),
        status: "needs_evidence", unresolved_claims: candidate?.unresolved_claims ?? ["Research has started; retained evidence is not yet complete."],
        research_notes: `${candidate?.research_notes ?? ""}\n\nResearch attempt ${researchKey} started. If completion is unavailable, a new human Needs research request is required.`.slice(0, 5000),
      })] });
      const researched = await researchPost(post, { now: options.now, fetchText: options.fetchText });
      const targets = identity.projects.get(researched.project_key);
      const targetId = candidate?.proposal_kind === "enrich" && candidate.target_example_id && byId.has(candidate.target_example_id) ? candidate.target_example_id : targets?.size === 1 ? [...targets][0] : undefined;
      if (targetId) {
        const existing = byId.get(targetId)!;
        researched.draft = { ...existing, sources: [...existing.sources, ...researched.draft.sources.filter((source) => !existing.sources.some((old) => canonicalSourceUrl(old.url) === canonicalSourceUrl(source.url)))].slice(0, 16) };
        researched.research_notes.unshift(`Proposed source enrichment for existing example ${targetId}; existing compatibility and evidence were preserved.`);
      } else if (targets && targets.size > 1) {
        researched.unresolved_claims.push(`Repository is already shared by multiple library records; choose the exact enrichment target: ${[...targets].join(", ")}.`);
      }
      const item = IngestItem.parse({ ...researched, project_key: candidate?.project_key ?? starter.project_key, ...(targetId ? { proposal_kind: "enrich", target_example_id: targetId } : {}), unresolved_claims: [...new Set([...(candidate?.unresolved_claims ?? []), ...researched.unresolved_claims])].slice(0, 30), source: { ...researched.source, excerpt: researched.source.excerpt.slice(0, 1200) }, research_notes: researched.research_notes.join("\n\n").slice(0, 5000) });
      await options.queue.ingest({ ...lease, items: [item] });
      checkpoints[researchKey] = "ingested"; await checkpoint();
    }
    if (client && budgetExhausted) providers.scrapecreators = "budget_exhausted";

    const grok = options.grok;
    if (grok && !knownRequests.has(requestId) && !run.grok_receipt) {
      checkpoints.grok_transport = "cli_webhook"; await checkpoint();
      const receipt = await sendGrokCliRequest({ requestId, task: researchTask, now: options.now, cli: grok.cli, env: grok.env,
        reserve: () => options.queue.reserveGrok(run.id, requestId),
        persist: async (grok_receipt) => {
          if (grok_receipt.status === "failed") await options.queue.harvest({ request_id: requestId, status: "failed", result_hash: digest(JSON.stringify(grok_receipt)), items: [] });
          else await options.queue.checkpoint({ ...lease, patch: { grok_receipt } });
        },
      });
      providers.grok = receipt.status; partial = true;
      coverage.push("GrokBot uses the CLI webhook only; upstream Grok access is not independently verified. Acknowledgement or pending is not completed research. Authenticated relay results are retained and ingested on a later run.");
    } else { providers.grok = knownRequests.has(requestId) || run.grok_receipt ? "receipt_retained_no_resend" : "unavailable_missing_credentials"; partial = true; }
    await checkpoint();
    const status = budgetExhausted ? "budget_exhausted" : partial ? "partial" : "completed";
    await options.queue.finish({ ...lease, status, coverage_notes: coverage.slice(0, 30).map((note) => note.slice(0, 600)) });
    return { status, run_id: run.id, candidates: selectedCount, provider_status: providers };
  } catch (error) {
    const errorCode = error instanceof Error && /^[a-z0-9_:]+$/.test(error.message) ? error.message.slice(0, 100) : "discovery_run_failed";
    await options.queue.finish({ ...lease, status: "failed", error_code: errorCode, coverage_notes: coverage.slice(0, 30).map((note) => note.slice(0, 600)) }).catch(() => {});
    throw new Error(errorCode);
  }
}

async function main() {
  const queries = QuerySchema.parse(JSON.parse(await readFile(new URL("../../discovery-queries.json", import.meta.url), "utf8")));
  const examples = ReverseEngineeringExampleCatalog.parse(JSON.parse(await readFile(new URL("../../reverse-engineering-examples.json", import.meta.url), "utf8")));
  const now = new Date();
  if (!process.argv.includes("--live")) {
    console.log(JSON.stringify({ status: "dry_run", window: discoveryWindow(now), searches: queries.length, max_hydrations: LIMIT, max_credits_daily: 12, max_credits_monthly: 360, coverage: SCRAPECREATORS_COVERAGE_NOTE, existing_examples: examples.length }));
    return;
  }
  if (process.env.DISCOVERY_PIPELINE_ENABLED !== "true") throw new Error("pipeline_not_enabled");
  const queue = createWorkerClient({ token: process.env.DISCOVERY_WORKER_TOKEN ?? "", url: process.env.DISCOVERY_WORKER_URL });
  const result = await runDiscovery({ queue, queries, examples, now,
    leaseOwner: `${process.env.GITHUB_RUN_ID ?? randomUUID()}:${process.env.GITHUB_RUN_ATTEMPT ?? "1"}`,
    scrapeKey: process.env.SCRAPECREATORS_API_KEY,
    grok: {}, // CLI reads GROKBOT_* variables or the private local config.
  });
  console.log(JSON.stringify(result));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error instanceof Error ? error.message : "discovery_run_failed"); process.exitCode = 1; });
