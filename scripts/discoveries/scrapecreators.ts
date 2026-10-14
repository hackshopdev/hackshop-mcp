import { canonicalSourceUrl, normalizePost, type DiscoveredPost } from "./canonicalize.js";

export const SCRAPECREATORS_BASE = "https://api.scrapecreators.com";
export const SCRAPECREATORS_COVERAGE_NOTE = "Six first-page queries of Google-indexed public X posts; results are ranked, incomplete and can omit recent posts. No native X search or exhaustive latest coverage is claimed.";
export type ProviderCallState = "started" | "completed" | "failed" | "unknown";
type ProviderData = Record<string, any>;
export type ProviderResult = { status: "completed" | "failed" | "unknown" | "budget_exhausted" | "replayed"; data?: ProviderData; error?: string; posts?: DiscoveredPost[] };

type Options = {
  apiKey: string;
  reserve: (key: string) => Promise<boolean | { allowed: boolean; replayed?: boolean }>;
  settle: (key: string, charged: number) => Promise<void>;
  checkpoint: (key: string, state: ProviderCallState, detail?: Record<string, unknown>) => Promise<void>;
  fetch?: typeof fetch;
};

export async function readBoundedJson(response: Response, maxBytes = 1_000_000): Promise<ProviderData> {
  const contentLength = Number(response.headers.get("content-length") ?? "0");
  if (contentLength > maxBytes) throw new Error("provider_body_too_large");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("empty_provider_body");
  const parts: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) throw new Error("provider_body_too_large");
      parts.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  const data = JSON.parse(Buffer.concat(parts).toString("utf8"));
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("invalid_provider_object");
  return data;
}

export function createScrapeCreatorsClient(options: Options) {
  const request = options.fetch ?? fetch;
  async function call(key: string, path: string, params: Record<string, string>): Promise<ProviderResult> {
    const reservation = await options.reserve(key);
    if (!(typeof reservation === "boolean" ? reservation : reservation.allowed)) return { status: "budget_exhausted" };
    if (typeof reservation !== "boolean" && reservation.replayed) return { status: "replayed" };
    // The receipt commits before network I/O. An exception leaves the reservation
    // consumed, so an expired runner lease cannot replay an ambiguous paid call.
    await options.checkpoint(key, "started");
    const url = new URL(path, SCRAPECREATORS_BASE);
    for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
    let response: Response;
    try {
      response = await request(url, {
        method: "GET", redirect: "error", headers: { "x-api-key": options.apiKey, accept: "application/json" },
        signal: AbortSignal.timeout(45_000),
      });
    } catch {
      await options.settle(key, 1);
      await options.checkpoint(key, "unknown", { error_code: "provider_transport_unknown" });
      return { status: "unknown", error: "provider_transport_unknown" };
    }
    let data: ProviderData;
    try { data = await readBoundedJson(response); } catch {
      await options.settle(key, 1);
      await options.checkpoint(key, "unknown", { http_status: response.status, error_code: "provider_response_unreadable" });
      return { status: "unknown", error: "provider_response_unreadable" };
    }
    const charge = Number.isInteger(data.credits_charged) && data.credits_charged >= 0 ? data.credits_charged : 1;
    await options.settle(key, charge);
    if (!response.ok || data.success !== true || charge > 1) {
      const error = charge > 1 ? "unexpected_credit_charge" : `provider_http_${response.status}`;
      await options.checkpoint(key, "failed", { http_status: response.status, credits_charged: charge, error_code: error });
      return { status: "failed", error };
    }
    const posts = Array.isArray(data.posts) ? data.posts.map(normalizePost).filter(Boolean) as DiscoveredPost[] : undefined;
    await options.checkpoint(key, "completed", { http_status: response.status, credits_charged: charge, result_count: posts?.length ?? 1, ...(posts ? { posts } : {}) });
    return { status: "completed", data, posts };
  }
  return {
    search: (key: string, query: string) => call(key, "/v1/twitter/search/posts", { query }),
    hydrate: (key: string, url: string) => call(key, "/v1/twitter/tweet", { url: canonicalSourceUrl(url), trim: "true", cache_max_age: "1d" }),
    balance: (key: string) => call(key, "/v1/account/credit-balance", {}),
  };
}
