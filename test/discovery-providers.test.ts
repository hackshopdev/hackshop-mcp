import { describe, expect, it } from "vitest";

const canonical = await import("../scripts/discoveries/canonicalize.js").catch(() => ({})) as typeof import("../scripts/discoveries/canonicalize.js");
const provider = await import("../scripts/discoveries/scrapecreators.js").catch(() => ({})) as typeof import("../scripts/discoveries/scrapecreators.js");
const grok = await import("../scripts/discoveries/grok.js").catch(() => ({})) as typeof import("../scripts/discoveries/grok.js");
const runner = await import("../scripts/discoveries/run.js").catch(() => ({})) as typeof import("../scripts/discoveries/run.js");

describe("hardware discovery provider boundaries", () => {
  it("deduplicates X URLs by status id, irrespective of renamed handles or tracking", () => {
    expect(canonical.canonicalSourceUrl?.("https://twitter.com/OldName/status/2110178596107248127?utm_source=x#video"))
      .toBe("https://x.com/i/status/2110178596107248127");
    expect(canonical.canonicalSourceUrl?.("https://x.com/NewName/status/2110178596107248127/video/1"))
      .toBe("https://x.com/i/status/2110178596107248127");
  });

  it("uses the repository as the project key across README and tree URLs", () => {
    expect(canonical.projectKey?.(["https://github.com/Owner/Project/blob/main/README.md"]))
      .toBe("github:owner/project");
    expect(canonical.projectKey?.(["https://github.com/owner/project/tree/development"]))
      .toBe("github:owner/project");
  });

  it("reserves one durable credit before every paid request and settles actual charges", async () => {
    const order: string[] = [];
    const client = provider.createScrapeCreatorsClient?.({
      apiKey: "test-only",
      reserve: async (key) => { order.push(`reserve:${key}`); return true; },
      settle: async (key, charged) => { order.push(`settle:${key}:${charged}`); },
      checkpoint: async (key, state) => { order.push(`${state}:${key}`); },
      fetch: async (url, options) => {
        order.push("fetch");
        expect(String(url)).toContain("/v1/twitter/search/posts?query=");
        expect(options?.redirect).toBe("error");
        return new Response(JSON.stringify({ success: true, credits_charged: 1, posts: [], cursor: "2" }));
      },
    });
    await client?.search("query-0", "hardware");
    expect(order).toEqual(["reserve:query-0", "started:query-0", "fetch", "settle:query-0:1", "completed:query-0"]);
  });

  it("never contacts a provider when its durable budget reservation is refused", async () => {
    let contacts = 0;
    const client = provider.createScrapeCreatorsClient?.({
      apiKey: "test-only", reserve: async () => false, settle: async () => {}, checkpoint: async () => {},
      fetch: async () => { contacts++; return new Response("{}"); },
    });
    const result = await client?.balance("balance");
    expect(result).toEqual({ status: "budget_exhausted" });
    expect(contacts).toBe(0);
  });

  it("keeps an ambiguous transport outcome charged and never retries it", async () => {
    const charges: number[] = [];
    const states: string[] = [];
    let contacts = 0;
    const client = provider.createScrapeCreatorsClient?.({
      apiKey: "test-only", reserve: async () => true,
      settle: async (_key, charge) => { charges.push(charge); },
      checkpoint: async (_key, state) => { states.push(state); },
      fetch: async () => { contacts++; throw new Error("network timeout with unknown acceptance"); },
    });
    const result = await client?.hydrate("tweet-1", "https://x.com/author/status/2110178596107248127");
    expect(result?.status).toBe("unknown");
    expect(contacts).toBe(1);
    expect(charges).toEqual([1]);
    expect(states).toEqual(["started", "unknown"]);
  });

  it("uses the current official credit-balance endpoint rather than the stale skill alias", async () => {
    let path: string | undefined;
    const client = provider.createScrapeCreatorsClient?.({
      apiKey: "test-only", reserve: async () => true, settle: async () => {}, checkpoint: async () => {},
      fetch: async (url) => { path = new URL(String(url)).pathname; return new Response(JSON.stringify({ success: true, credits_charged: 1, creditCount: 20 })); },
    });
    expect((await client?.balance("balance"))?.data?.creditCount).toBe(20);
    expect(path).toBe("/v1/account/credit-balance");
  });






  it("uses a 72-hour overlap, with a bounded 14-day Sunday backfill", () => {
    expect(runner.discoveryWindow?.(new Date("2026-10-14T13:00:00Z"))).toEqual({ start: "2026-10-11T13:00:00.000Z", end: "2026-10-14T13:00:00.000Z", backfill: false });
    expect(runner.discoveryWindow?.(new Date("2026-10-18T13:00:00Z"))).toEqual({ start: "2026-10-04T13:00:00.000Z", end: "2026-10-18T13:00:00.000Z", backfill: true });
  });

  it("returns a completed run replay without any provider or queue writes", async () => {
    let contacts = 0;
    const result = await runner.runDiscovery({
      queue: { begin: async () => ({ run: { id: "run-1", status: "completed" }, replayed: true }) } as any,
      queries: Array.from({ length: 6 }, (_, i) => ({ id: `query-${i}`, query: "hardware" })), examples: [], now: new Date("2026-10-14T12:00:00Z"), leaseOwner: "test",
      scrapeKey: "test-only", providerFetch: async () => { contacts++; return new Response("{}"); },
    });
    expect(result.status).toBe("replayed");
    expect(contacts).toBe(0);
  });

  it("limits a run to six searches and five hydrations plus balance, keeping reviewed discoveries untouched", async () => {
    const calls: string[] = [];
    const ingested: any[] = [];
    const reservations = new Set<string>();
    const run = { id: "90ff176e-12f4-4540-ad30-d77826c00117", status: "running", checkpoints: {}, provider_status: {}, grok_receipt: null };
    const queue = {
      begin: async () => ({ run, replayed: false }), checkpoint: async () => ({ run }), finish: async () => ({ run }),
      reserve: async (_run: string, key: string) => { const replayed = reservations.has(key); reservations.add(key); return { allowed: true, replayed }; }, settle: async () => ({}),
      ingest: async (input: any) => { ingested.push(...input.items); return { candidates: [] }; },
      pending: async () => ({ runs: [], candidates: [{ project_key: "source:https://x.com/i/status/2110178596107248127", publication_status: "unreviewed", research_status: "needs_evidence", sources: [{ url: "https://x.com/i/status/2110178596107248127", excerpt: "I rooted a dashboard", author: "maker", published_at: "2026-10-14T10:00:00Z" }] }] }),
    };
    await runner.runDiscovery({ queue: queue as any, queries: Array.from({ length: 6 }, (_, i) => ({ id: `query-${i}`, query: "hardware" })), examples: [], now: new Date("2026-10-14T12:00:00Z"), leaseOwner: "test", scrapeKey: "test-only",
      providerFetch: async (input) => {
        const path = new URL(String(input)).pathname; calls.push(path);
        if (path.includes("credit-balance")) return new Response(JSON.stringify({ success: true, credits_charged: 1, creditCount: 100 }));
        if (path.includes("search/posts")) return new Response(JSON.stringify({ success: true, credits_charged: 1, posts: Array.from({ length: 7 }, (_, i) => ({ rest_id: `211017859610724812${i}`, legacy: { full_text: `I rooted hardware dashboard ${i}`, created_at: "Wed Oct 14 10:00:00 +0000 2026" } })) }));
        const id = new URL(String(input)).searchParams.get("url")!.split("/").at(-1);
        return new Response(JSON.stringify({ success: true, credits_charged: 1, rest_id: id, legacy: { full_text: "I rooted a dashboard", created_at: "Wed Oct 14 10:00:00 +0000 2026" } }));
      }, fetchText: async (url) => ({ url, text: "source", contentType: "text/plain" }),
    });
    expect(calls.filter((path) => path.includes("search/posts"))).toHaveLength(6);
    expect(calls.filter((path) => path.endsWith("/tweet"))).toHaveLength(5);
    expect(calls).toHaveLength(12);
    expect(ingested.filter((item) => item.draft)).toHaveLength(5);
    expect(ingested.some((item) => item.source.url.endsWith("2110178596107248127"))).toBe(false);
  });







  it("includes normalized public post seeds in a completed provider receipt", async () => {
    let seed: any;
    const client = provider.createScrapeCreatorsClient({ apiKey: "test-only", reserve: async () => true, settle: async () => {},
      checkpoint: async (_key, state, detail) => { if (state === "completed") seed = detail?.posts; },
      fetch: async () => new Response(JSON.stringify({ success: true, credits_charged: 1, posts: [{ rest_id: "2110178596107248127", legacy: { full_text: "I rooted hardware for a calendar" } }] })),
    });
    await client.search("search-1", "hardware");
    expect(seed?.[0]?.id).toBe("2110178596107248127");
    expect(seed?.[0]?.url).toBe("https://x.com/i/status/2110178596107248127");
  });

  it("resumes stored source seeds without reissuing completed paid searches", async () => {
    const calls: string[] = [];
    const ingested: any[] = [];
    const run = { id: "90ff176e-12f4-4540-ad30-d77826c00117", status: "running", checkpoints: { calls: Object.fromEntries(["scrape:balance", ...Array.from({ length: 6 }, (_, i) => `scrape:search:${i}`)].map((key) => [key, { state: "completed" }])), discovered_posts: [{ id: "2110178596107248127", url: "https://x.com/i/status/2110178596107248127", text: "I rooted hardware for a calendar", links: [] }] }, provider_status: {}, grok_receipt: null };
    const queue = {
      begin: async () => ({ run, replayed: true }), checkpoint: async () => ({ run }), finish: async () => ({ run }), pending: async () => ({ candidates: [], runs: [] }),
      reserve: async () => ({ allowed: true, replayed: false }), settle: async () => ({}), ingest: async (input: any) => { ingested.push(...input.items); return { candidates: [] }; },
    };
    await runner.runDiscovery({ queue: queue as any, queries: Array.from({ length: 6 }, (_, i) => ({ id: `query-${i}`, query: "hardware" })), examples: [], now: new Date("2026-10-14T12:00:00Z"), leaseOwner: "test", scrapeKey: "test-only",
      providerFetch: async (url) => { calls.push(new URL(String(url)).pathname); return new Response(JSON.stringify({ success: true, credits_charged: 1, rest_id: "2110178596107248127", legacy: { full_text: "I rooted hardware for a calendar" } })); },
      fetchText: async (url) => ({ url, text: "source", contentType: "text/plain" }),
    });
    expect(calls).toEqual(["/v1/twitter/tweet"]);
    expect(ingested.filter((item) => item.draft)).toHaveLength(1);
  });

  it("researches a manual primary URL without ScrapeCreators credentials or paid hydration", async () => {
    const ingested: any[] = [];
    const reads: string[] = [];
    let contacts = 0;
    const run = { id: "90ff176e-12f4-4540-ad30-d77826c00117", status: "running", checkpoints: {}, provider_status: {}, grok_receipt: null };
    const queue = {
      begin: async () => ({ run, replayed: false }), checkpoint: async () => ({ run }), finish: async () => ({ run }),
      pending: async () => ({ runs: [], candidates: [{ id: "queued-1", draft_version: 2, project_key: "url:manual-repository-digest", unresolved_claims: ["Retained human question"], publication_status: "unreviewed", research_status: "researching", sources: [{ url: "https://github.com/maker/dashboard", kind: "repo", excerpt: "", author: null, published_at: null }] }] }),
      ingest: async (input: any) => { ingested.push(...input.items); return { candidates: [] }; },
    };
    const result = await runner.runDiscovery({ queue: queue as any, queries: Array.from({ length: 6 }, (_, i) => ({ id: `query-${i}`, query: "hardware" })), examples: [], now: new Date("2026-10-14T12:00:00Z"), leaseOwner: "test",
      providerFetch: async () => { contacts++; return new Response("{}"); },
      fetchText: async (url) => { reads.push(url); return { url, text: "# Dashboard\nExperimental ESP32 calendar display.", contentType: "text/plain" }; },
    });
    expect(contacts).toBe(0);
    expect(result.candidates).toBe(1);
    expect(reads).toEqual(["https://api.github.com/repos/maker/dashboard/readme"]);
    expect(ingested.filter((item) => item.draft)).toHaveLength(1);
    expect(ingested.at(-1)?.draft.evidence).toBe("documented");
    expect(ingested.at(-1)?.project_key).toBe("url:manual-repository-digest");
    expect(ingested[0]?.status).toBe("needs_evidence");
    expect(ingested[0]?.unresolved_claims).toEqual(["Retained human question"]);
  });

  it("does not replay an ambiguous research attempt, but permits a distinct human-requested version", async () => {
    const run = { id: "90ff176e-12f4-4540-ad30-d77826c00117", status: "running", checkpoints: { "research:queued-1:1": "started" }, provider_status: {}, grok_receipt: null };
    const ingested: any[] = [];
    const queue = {
      begin: async () => ({ run, replayed: true }), checkpoint: async () => ({ run }), finish: async () => ({ run }),
      pending: async () => ({ runs: [], candidates: [{ id: "queued-1", draft_version: 2, project_key: "github:maker/dashboard", publication_status: "unreviewed", research_status: "researching", sources: [{ url: "https://github.com/maker/dashboard", kind: "repo", excerpt: "", author: null, published_at: null }] }] }),
      ingest: async (input: any) => { ingested.push(...input.items); return { candidates: [] }; },
    };
    await runner.runDiscovery({ queue: queue as any, queries: Array.from({ length: 6 }, (_, i) => ({ id: `query-${i}`, query: "hardware" })), examples: [], now: new Date("2026-10-14T12:00:00Z"), leaseOwner: "test", fetchText: async (url) => ({ url, text: "# Repo", contentType: "text/plain" }) });
    expect(ingested.filter((item) => item.draft)).toHaveLength(1);
    (queue.pending as any) = async () => ({ runs: [], candidates: [{ id: "queued-1", draft_version: 1, project_key: "github:maker/dashboard", publication_status: "unreviewed", research_status: "researching", sources: [{ url: "https://github.com/maker/dashboard", kind: "repo", excerpt: "", author: null, published_at: null }] }] });
    ingested.length = 0;
    await runner.runDiscovery({ queue: queue as any, queries: Array.from({ length: 6 }, (_, i) => ({ id: `query-${i}`, query: "hardware" })), examples: [], now: new Date("2026-10-14T12:00:00Z"), leaseOwner: "test", fetchText: async () => { throw new Error("must not repeat"); } });
    expect(ingested).toHaveLength(0);
  });


  it("keeps combined manual research at five jobs and checkpoint payloads below 16KB", async () => {
    const ingested: any[] = [];
    let maxCheckpointBytes = 0;
    const run = { id: "90ff176e-12f4-4540-ad30-d77826c00117", status: "running", checkpoints: {}, provider_status: {}, grok_receipt: null };
    const queue = {
      begin: async () => ({ run, replayed: false }), checkpoint: async (input: any) => { maxCheckpointBytes = Math.max(maxCheckpointBytes, Buffer.byteLength(JSON.stringify(input.patch.checkpoints))); return { run }; }, finish: async () => ({ run }),
      pending: async () => ({ runs: [], candidates: Array.from({ length: 7 }, (_, i) => ({ id: `queued-${i}`, draft_version: 1, project_key: `url:digest-${i}`, publication_status: "unreviewed", research_status: "discovered", sources: [{ url: `https://docs.project${i}.org/guide?filter=${"a".repeat(400)}`, kind: "guide", excerpt: "", author: null, published_at: null }] })) }),
      ingest: async (input: any) => { ingested.push(...input.items); return { candidates: [] }; },
    };
    const result = await runner.runDiscovery({ queue: queue as any, queries: Array.from({ length: 6 }, (_, i) => ({ id: `query-${i}`, query: "hardware" })), examples: [], now: new Date("2026-10-14T12:00:00Z"), leaseOwner: "test", fetchText: async (url) => ({ url, text: "# Experimental calendar implementation", contentType: "text/plain" }) });
    expect(result.candidates).toBe(5);
    expect(ingested.filter((item) => item.draft)).toHaveLength(5);
    expect(maxCheckpointBytes).toBeLessThanOrEqual(16_000);
  });
});
